#!/usr/bin/env python3
"""Quiescent encrypted backup. Not run automatically; requires an explicit maintenance window."""
import argparse,datetime,hashlib,json,os,pathlib,re,shutil,subprocess,tempfile
p=argparse.ArgumentParser()
p.add_argument('--compose',required=True);p.add_argument('--env-file',required=True);p.add_argument('--project',required=True)
p.add_argument('--destination',required=True);p.add_argument('--scratch',required=True);p.add_argument('--recipient',required=True)
p.add_argument('--signer',required=True)
p.add_argument('--proof-order',type=int,required=True);p.add_argument('--confirm-maintenance',action='store_true')
a=p.parse_args();os.umask(0o077)
checkout=pathlib.Path(__file__).resolve().parents[3]
if pathlib.Path(a.scratch).resolve().is_relative_to(checkout):raise SystemExit('Plaintext backup scratch must be outside the Git checkout/web source')
if not a.confirm_maintenance:raise SystemExit('Explicit maintenance confirmation required: PHP will be stopped temporarily')
if not re.fullmatch('[A-Za-z0-9_-]+',a.project) or any(not re.fullmatch('[A-Fa-f0-9]{40,64}',x) for x in [a.recipient,a.signer]):raise SystemExit('Project and full recipient fingerprint required')
if not shutil.which('gpg'):raise SystemExit('Install GnuPG and import the verified recipient public key first')
cmd=['docker','--host=unix:///var/run/docker.sock','compose','-p',a.project,'-f',str(pathlib.Path(a.compose).resolve()),'--env-file',str(pathlib.Path(a.env_file).resolve())]
env=os.environ.copy()
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
def run(*args,**kw):return subprocess.run(cmd+list(args),env=env,check=True,**kw)
if not run('ps','--status','running','-q','wordpress',capture_output=True,text=True).stdout.strip():raise SystemExit('Source PHP must be running before the maintenance window')
scratch_root=pathlib.Path(a.scratch).resolve();scratch_root.mkdir(parents=True,exist_ok=True);scratch_root.chmod(0o700)
dest=pathlib.Path(a.destination).resolve();dest.mkdir(parents=True,exist_ok=True);dest.chmod(0o700)
# This scratch filesystem MUST be encrypted/private and outside Git; plaintext SQL exists only here.
with tempfile.TemporaryDirectory(prefix='woodbase-backup-',dir=scratch_root) as tmp:
 root=pathlib.Path(tmp);root.chmod(0o700)
 proof='''$_SERVER["HTTP_HOST"]="localhost";require "/var/www/html/wp-load.php";$o=wc_get_order((int)$argv[1]);if(!$o)exit(2);
 foreach($o->get_items() as $i){$raw=$i->get_meta("_woodbase_configuration");$c=json_decode($raw,true);$id=$c["artwork"]["fileId"]??null;if($id){echo json_encode(["order"=>$o->get_id(),"file"=>$id,"snapshot_sha256"=>hash("sha256",$raw),"file_sha256"=>hash_file("sha256",WOODBASE_PRIVATE_DIR."/".$id.".png")]);exit;}}exit(3);'''
 evidence=json.loads(run('exec','-T','wordpress','php','-r',proof,str(a.proof_order),capture_output=True,text=True).stdout)
 (root/'proof.json').write_text(json.dumps(evidence));shutil.copyfile(a.env_file,root/'environment.env')
 # Configuration/source backup, excluding credentials kept separately above and generated data.
 source=pathlib.Path(__file__).resolve().parents[1]
 with (root/'infrastructure.tar').open('wb') as out:subprocess.run(['tar','--exclude=.env','--exclude=__pycache__','-C',str(source),'-cf','-','ops','plugin','compose.yaml','nginx.conf','php-uploads.ini'],stdout=out,check=True)
 (root/'manifest.json').write_text(json.dumps({'format':1,'integration_sha256':hashlib.sha256(b''.join(x.name.encode()+b'\0'+x.read_bytes() for x in sorted((source/'plugin').glob('*.php')))).hexdigest(),'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'project':a.project,'components':['database.sql','wordpress.tar','private.tar','infrastructure.tar','environment.env','proof.json']}))
 stopped=False
 try:
  run('stop','wordpress');stopped=True
  dump='''umask 077; f=$(mktemp); trap 'rm -f "$f"' EXIT; printf '[client]\nuser=root\npassword=%s\n' "$MARIADB_ROOT_PASSWORD" > "$f"; mariadb-dump --defaults-extra-file="$f" --single-transaction --routines --events woodbase'''
  with (root/'database.sql').open('wb') as out:run('exec','-T','db','sh','-c',dump,stdout=out)
  for name,path in [('wordpress','/var/www/html'),('private','/var/woodbase-private')]:
   with (root/(name+'.tar')).open('wb') as out:run('run','--rm','--no-deps','-T','--entrypoint','tar','wordpress',*(['--exclude=./wp-content/plugins/woodbase','--exclude=./wp-content/plugins/woocommerce','--exclude=./wp-content/mu-plugins/woodbase-staging.php'] if name=='wordpress' else []),'-C',path,'-cf','-','.',stdout=out)
 finally:
  if stopped:run('start','wordpress')
 name=a.project+'-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.tar.gpg';partial=dest/(name+'.partial')
 stream=subprocess.Popen(['tar','-C',str(root),'-cf','-','.'],stdout=subprocess.PIPE)
 try:
  subprocess.run(['gpg','--batch','--yes','--trust-model','always','--recipient',a.recipient,'--local-user',a.signer,'--sign','--encrypt','--output',str(partial)],stdin=stream.stdout,check=True)
  stream.stdout.close()
  if stream.wait()!=0:raise RuntimeError('Backup archive stream failed')
  partial.chmod(0o600);partial.rename(dest/name)
 except BaseException:
  stream.kill();stream.wait();partial.unlink(missing_ok=True);raise
 print('Encrypted backup created. Transfer to a separate private Russian-region storage and run restore acceptance; archive creation alone is not acceptance.')
