#!/usr/bin/env python3
"""Restore only into a new local/staging project. Never overwrites an existing volume."""
import argparse,json,os,pathlib,re,shutil,subprocess,tarfile,tempfile,time,hashlib
p=argparse.ArgumentParser()
p.add_argument('--archive',required=True);p.add_argument('--compose',required=True);p.add_argument('--project',required=True)
p.add_argument('--signer',required=True);p.add_argument('--env-out',required=True)
p.add_argument('--scratch',required=True);p.add_argument('--probe-container',required=True)
a=p.parse_args();os.umask(0o077)
checkout=pathlib.Path(__file__).resolve().parents[3]
if pathlib.Path(a.scratch).resolve().is_relative_to(checkout):raise SystemExit('Plaintext backup scratch must be outside the Git checkout/web source')
if not re.fullmatch('[A-Fa-f0-9]{40,64}',a.signer):raise SystemExit('Full trusted signer fingerprint required')
if pathlib.Path(a.env_out).resolve().is_relative_to(checkout):raise SystemExit('Restored secrets must be saved outside Git')
if pathlib.Path(a.env_out).exists():raise SystemExit('Refusing to overwrite an environment file')
if not re.fullmatch('woodbase-restore-[a-z0-9-]+',a.project):raise SystemExit('Use a new project named woodbase-restore-...')
env=os.environ.copy()
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
docker=['docker','--host=unix:///var/run/docker.sock']
# Check the daemon filesystem through an existing container, not the unrelated executor filesystem.
df=subprocess.check_output(docker+['exec',a.probe_container,'df','-Pk','/var/www/html'],env=env,text=True)
free=int(df.strip().splitlines()[-1].split()[3])*1024
if free<8*1024**3:raise SystemExit('BLOCKED: restore needs at least 8 GiB free on the Docker daemon filesystem; existing data will not be deleted')
for kind,extra in [('container',['ps','-aq']),('volume',['volume','ls','-q'])]:
 if subprocess.check_output(docker+extra+['--filter','label=com.docker.compose.project='+a.project],env=env,text=True).strip():raise SystemExit('Refusing to reuse existing restore resources')
root=pathlib.Path(a.scratch).resolve();root.mkdir(parents=True,exist_ok=True);root.chmod(0o700)
with tempfile.TemporaryDirectory(prefix='woodbase-restore-',dir=root) as temp:
 scratch=pathlib.Path(temp);bundle=scratch/'bundle.tar'
 with bundle.open('wb') as out:decrypted=subprocess.run(['gpg','--batch','--status-fd','2','--decrypt',a.archive],stdout=out,stderr=subprocess.PIPE,text=False,check=True)
 signatures=re.findall(rb'\[GNUPG:\] VALIDSIG ([^\r\n]+)',decrypted.stderr)
 if not any(a.signer.upper().encode() in line.upper().split() for line in signatures):raise RuntimeError('Backup is not signed by the expected signer')
 with tarfile.open(bundle) as archive:
  for member in archive.getmembers():
   if not (scratch/member.name).resolve().is_relative_to(scratch) or member.issym() or member.islnk():raise RuntimeError('Unsafe outer backup member')
  archive.extractall(scratch,filter='data')
 manifest=json.loads((scratch/'manifest.json').read_text())
 if manifest['format']!=1:raise RuntimeError('Unsupported backup format')
 compose_dir=pathlib.Path(a.compose).resolve().parent
 plugin=compose_dir/'plugin' if (compose_dir/'plugin').is_dir() else compose_dir.parent/'plugin'
 selected=hashlib.sha256(b''.join(x.name.encode()+b'\0'+x.read_bytes() for x in sorted(plugin.glob('*.php')))).hexdigest()
 if selected!=manifest.get('integration_sha256'):raise RuntimeError('Prepare the matching archived WoodBase release before restoring; no application code is overwritten')
 envfile=pathlib.Path(a.env_out).resolve();envfile.parent.mkdir(parents=True,exist_ok=True)
 with envfile.open('xb') as target:target.write((scratch/'environment.env').read_bytes())
 envfile.chmod(0o600)
 cmd=docker+['compose','-p',a.project,'-f',str(pathlib.Path(a.compose).resolve()),'--env-file',str(envfile)]
 def run(*args,**kw):return subprocess.run(cmd+list(args),env=env,check=True,**kw)
 # No web service/ports: restored WordPress stays private until its URLs and secrets are reviewed.
 run('up','-d','db')
 for _ in range(30):
  ready=subprocess.run(cmd+['exec','-T','db','healthcheck.sh','--connect','--innodb_initialized'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  if ready.returncode==0:break
  time.sleep(1)
 else:raise RuntimeError('Restored database initialization timed out')
 restore='''umask 077; f=$(mktemp); trap 'rm -f "$f"' EXIT; printf '[client]\nuser=root\npassword=%s\n' "$MARIADB_ROOT_PASSWORD" > "$f"; mariadb --defaults-extra-file="$f" woodbase'''
 with (scratch/'database.sql').open('rb') as stream:run('exec','-T','db','sh','-c',restore,stdin=stream)
 for name,path in [('wordpress','/var/www/html'),('private','/var/woodbase-private')]:
  # Inspect all inner paths before invoking tar. Never permit devices, absolute paths or traversal.
  with tarfile.open(scratch/(name+'.tar')) as archive:
   for m in archive.getmembers():
    if pathlib.PurePosixPath(m.name).is_absolute() or '..' in pathlib.PurePosixPath(m.name).parts or not (m.isfile() or m.isdir()):raise RuntimeError('Unsafe inner backup member')
  with (scratch/(name+'.tar')).open('rb') as stream:run('run','--rm','--no-deps','-T','--entrypoint','tar','wordpress','-C',path,'-xf','-',stdin=stream)
 run('run','--rm','--no-deps','-T','--entrypoint','sh','wordpress','-c','if [ -d /opt/woodbase-downloads/woocommerce ]; then cp -a /opt/woodbase-downloads/woocommerce /var/www/html/wp-content/plugins/; chown -R www-data:www-data /var/www/html/wp-content/plugins/woocommerce; fi')
 run('up','-d','wordpress')
 proof=json.loads((scratch/'proof.json').read_text())
 verify='''$_SERVER["HTTP_HOST"]="localhost";require "/var/www/html/wp-load.php";$expected=json_decode($argv[1],true);$o=wc_get_order($expected["order"]);if(!$o)exit(2);foreach($o->get_items() as $i){$raw=$i->get_meta("_woodbase_configuration");$c=json_decode($raw,true);if(($c["artwork"]["fileId"]??null)===$expected["file"]&&hash("sha256",$raw)===$expected["snapshot_sha256"]&&hash_file("sha256",WOODBASE_PRIVATE_DIR."/".$expected["file"].".png")===$expected["file_sha256"]){echo "PASS restored order snapshot and private production file match\\n";exit;}}exit(3);'''
 # Proof contains only opaque IDs and hashes, never customer names or file contents.
 run('exec','-T','wordpress','php','-r',verify,json.dumps(proof))
 print('Restore proof passed. No web service exposed. Review URLs/mail/gateways, then perform the admin download and guest-checkout acceptance.')
