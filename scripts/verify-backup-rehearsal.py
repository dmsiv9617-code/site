#!/usr/bin/env python3
"""Encrypted backup/restore rehearsal using an isolated temporary database, not a second Docker stack."""
import os,pathlib,subprocess,tempfile,json,secrets,re,tarfile,time,shutil
root=pathlib.Path(__file__).resolve().parents[1];env=os.environ.copy();os.umask(0o077)
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
docker=['docker','--host=unix:///var/run/docker.sock'];wp='woodbase-local-wordpress-1';db='woodbase-local-db-1'
# A second full stack is blocked by VFS disk. This cheaper test still needs real temporary space.
free=int(subprocess.check_output(docker+['exec',wp,'df','-Pk','/var/www/html'],env=env,text=True).strip().splitlines()[-1].split()[3])*1024
if free<700*1024*1024:raise SystemExit('BLOCKED: logical restore rehearsal requires 700 MiB free; working data will not be deleted')
proof_order=int(re.search(r'order-received/(\d+)',json.loads((root/'work/verification/order.json').read_text())['url'])[1])
name='woodbase_restore_test_'+secrets.token_hex(5);remote='/tmp/'+name;created=False;granted=False;server=False;proxy_config=None
root_sql='''umask 077; f=$(mktemp); trap 'rm -f "$f"' EXIT; printf '[client]\nuser=root\npassword=%s\n' "$MARIADB_ROOT_PASSWORD" > "$f"; mariadb --defaults-extra-file="$f"'''
def sql(text,database=None):
 args=docker+['exec','-i',db,'sh','-c',root_sql+(' --database='+database if database else '')]
 return subprocess.run(args,env=env,input=text.encode() if isinstance(text,str) else text,check=True,capture_output=True).stdout
with tempfile.TemporaryDirectory(prefix='woodbase-backup-proof-',dir='/tmp') as tmp:
 tmp=pathlib.Path(tmp);keys=tmp/'keys';keys.mkdir(mode=0o700);env['GNUPGHOME']=str(keys)
 try:
  subprocess.run(['gpg','--batch','--passphrase','','--quick-generate-key','WoodBase rehearsal <backup@example.test>','default','default','1d'],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  listing=subprocess.check_output(['gpg','--batch','--with-colons','--list-keys'],env=env,text=True)
  fingerprint=next(x.split(':')[9] for x in listing.splitlines() if x.startswith('fpr:'))
  subprocess.run(['python3',str(root/'integrations/woocommerce/ops/backup.py'),'--compose',str(root/'integrations/woocommerce/compose.yaml'),'--env-file',str(root/'integrations/woocommerce/.env'),'--project','woodbase-local','--destination',str(tmp/'encrypted'),'--scratch',str(tmp/'scratch'),'--recipient',fingerprint,'--signer',fingerprint,'--proof-order',str(proof_order),'--confirm-maintenance'],env=env,check=True,cwd=root)
  encrypted=next((tmp/'encrypted').glob('*.gpg'));bundle=tmp/'bundle.tar'
  with bundle.open('wb') as out:verification=subprocess.run(['gpg','--batch','--status-fd','2','--decrypt',str(encrypted)],env=env,stdout=out,stderr=subprocess.PIPE,check=True)
  assert any(fingerprint.encode() in line.split() for line in re.findall(rb'\[GNUPG:\] VALIDSIG ([^\r\n]+)',verification.stderr))
  restored=tmp/'restored';restored.mkdir(mode=0o700)
  with tarfile.open(bundle) as t:t.extractall(restored,filter='data')
  proof=json.loads((restored/'proof.json').read_text());dump=(restored/'database.sql').read_bytes()
  if re.search(rb'(?im)^\s*(USE\s|CREATE\s+DATABASE)|`woodbase`\.',dump):raise RuntimeError('Unsafe cross-schema dump for logical restore; no database changed')
  exists=sql("SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='"+name+"';").decode().strip().splitlines()[-1]
  if exists!='0':raise RuntimeError('Temporary restore schema already exists')
  sql('CREATE DATABASE `'+name+'`;');created=True
  sql("GRANT ALL PRIVILEGES ON `"+name+"`.* TO 'woodbase'@'%';");granted=True
  sql(dump,name)
  subprocess.run(docker+['exec',wp,'mkdir','-p',remote+'/wp',remote+'/private'],env=env,check=True)
  for kind in ['wordpress','private']:
   subprocess.run(docker+['cp',str(restored/(kind+'.tar')),wp+':'+remote+'/'+kind+'.tar'],env=env,check=True)
   subprocess.run(docker+['exec',wp,'tar','-xf',remote+'/'+kind+'.tar','-C',remote+('/wp' if kind=='wordpress' else '/private')],env=env,check=True)
  # Restore our integration code from the signed infrastructure archive, not from the live checkout.
  subprocess.run(docker+['exec',wp,'mkdir','-p',remote+'/infra'],env=env,check=True)
  subprocess.run(docker+['cp',str(restored/'infrastructure.tar'),wp+':'+remote+'/infrastructure.tar'],env=env,check=True)
  subprocess.run(docker+['exec',wp,'tar','-xf',remote+'/infrastructure.tar','-C',remote+'/infra'],env=env,check=True)
  subprocess.run(docker+['exec',wp,'ln','-s',remote+'/infra/plugin',remote+'/wp/wp-content/plugins/woodbase'],env=env,check=True)
  # Third-party Woo is the unchanged verified 10.3.5 release, mounted separately in production as well.
  subprocess.run(docker+['exec',wp,'ln','-s','/var/www/html/wp-content/plugins/woocommerce',remote+'/wp/wp-content/plugins/woocommerce'],env=env,check=True)
  subprocess.run(docker+['exec',wp,'chown','-R','www-data:www-data',remote],env=env,check=True)
  networks=json.loads(subprocess.check_output(docker+['inspect','--format','{{json .NetworkSettings.Networks}}',wp],env=env));ip=next(iter(networks.values()))['IPAddress'];hostname='localhost';origin='http://localhost:8088/'+name
  extra="define('WP_ENVIRONMENT_TYPE','local');define('DISABLE_WP_CRON',true);define('WP_HTTP_BLOCK_EXTERNAL',true);define('WOODBASE_PRIVATE_DIR','"+remote+"/private');define('WOODBASE_FRONTEND_ORIGIN','"+origin+"');"
  exec_env=['-e','WORDPRESS_DB_NAME='+name,'-e','WORDPRESS_CONFIG_EXTRA='+extra]
  prepare="$_SERVER['HTTP_HOST']='localhost';require '"+remote+"/wp/wp-load.php';update_option('home',$argv[1]);update_option('siteurl',$argv[1]);update_option('woocommerce_coming_soon','no');"
  subprocess.run(docker+['exec',*exec_env,wp,'php','-r',prepare,origin],env=env,check=True)
  verify="$_SERVER['HTTP_HOST']='localhost';require '"+remote+"/wp/wp-load.php';$e=json_decode($argv[1],true);$o=wc_get_order($e['order']);if(!$o)exit(2);foreach($o->get_items() as $i){$raw=$i->get_meta('_woodbase_configuration');$c=json_decode($raw,true);if(($c['artwork']['fileId']??null)===$e['file']&&hash('sha256',$raw)===$e['snapshot_sha256']&&hash_file('sha256',WOODBASE_PRIVATE_DIR.'/'.$e['file'].'.png')===$e['file_sha256']){echo 'PASS restored order snapshot and private file SHA256'.PHP_EOL;exit;}}exit(3);"
  subprocess.run(docker+['exec',*exec_env,wp,'php','-r',verify,json.dumps(proof)],env=env,check=True)
  router="<?php $path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);if($path!=='/'&&is_file(__DIR__.$path))return false;require __DIR__.'/index.php';"
  local_router=tmp/'router.php';local_router.write_text(router)
  subprocess.run(docker+['cp',str(local_router),wp+':'+remote+'/wp/router.php'],env=env,check=True)
  subprocess.run(docker+['exec',wp,'chown','www-data:www-data',remote+'/wp/router.php'],env=env,check=True)
  launch='echo $$ > '+remote+'/server.pid; exec php -S 0.0.0.0:8099 -t '+remote+'/wp '+remote+'/wp/router.php > '+remote+'/server.log 2>&1'
  subprocess.run(docker+['exec','-u','www-data',*exec_env,'-d',wp,'sh','-c',launch],env=env,check=True);server=True
  proxy_config='/etc/nginx/conf.d/'+name+'.conf'
  proxy=tmp/'proxy.conf';base=(root/'integrations/woocommerce/nginx.conf').read_text();proxy.write_text(base.replace(' listen 80;', ' listen 80;\n server_name localhost;\n location ^~ /'+name+'/ { proxy_pass http://wordpress:8099/; proxy_set_header Host $http_host; }',1))
  subprocess.run(docker+['cp',str(proxy),'woodbase-local-web-1:'+proxy_config],env=env,check=True)
  subprocess.run(docker+['exec','woodbase-local-web-1','nginx','-s','reload'],env=env,check=True)
  for _ in range(30):
   ready=subprocess.run(['curl','--noproxy',hostname,'--resolve',hostname+':8088:127.0.0.1','-f','-sS','-o','/dev/null',origin+'/wp-login.php'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
   if ready.returncode==0:break
   time.sleep(.1)
  else:raise RuntimeError('Restored test server unavailable')
  subprocess.run(['node','scripts/verify-restored-order.mjs',origin,str(proof_order),proof['file_sha256']],env=env,check=True,cwd=root)
  (root/'work/verification/restore-proof.json').write_text(json.dumps({'order':proof_order,'snapshot_match':True,'private_png_match':True,'admin_download':True,'anonymous_denied':True,'isolated_database':True,'independent_server':False}))
  print('PASS encrypted/signed backup -> isolated database/files -> WC order and authorized HTTP PNG. No independent-host disaster-recovery acceptance claimed.')
 finally:
  if proxy_config:
   subprocess.run(docker+['exec','woodbase-local-web-1','rm','-f',proxy_config],env=env,check=True)
   subprocess.run(docker+['exec','woodbase-local-web-1','nginx','-s','reload'],env=env,check=True)
  if server:
   diagnostic=subprocess.run(docker+['exec',wp,'cat',remote+'/server.log'],env=env,capture_output=True).stdout
   (root/'work/verification/restore-server.log').write_bytes(diagnostic)
  if server:
   try:
    pid=int(subprocess.check_output(docker+['exec',wp,'cat',remote+'/server.pid'],env=env,text=True))
    args=subprocess.check_output(docker+['exec',wp,'cat','/proc/'+str(pid)+'/cmdline'],env=env)
    if remote.encode() in args:subprocess.run(docker+['exec',wp,'kill',str(pid)],env=env,check=True)
   except (subprocess.CalledProcessError,ValueError):pass
  subprocess.run(docker+['exec',wp,'rm','-rf',remote],env=env,check=True)
  if granted:
   try:sql("REVOKE ALL PRIVILEGES ON `"+name+"`.* FROM 'woodbase'@'%';")
   finally:
    if created:sql('DROP DATABASE `'+name+'`;');created=False
  if created:sql('DROP DATABASE `'+name+'`;')
  subprocess.run(['gpgconf','--homedir',str(keys),'--kill','gpg-agent'],env=env,check=False,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
