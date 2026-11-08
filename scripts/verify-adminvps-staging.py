#!/usr/bin/env python3
"""Read-only Compose safety checks. No up/down or real credentials."""
import json,os,pathlib,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
env=os.environ.copy()
env.update(DB_PASSWORD='validation-only',DB_ROOT_PASSWORD='validation-only',WOODBASE_DOMAIN='localhost',TLS_DIR='/tmp/woodbase-validation-tls',STAGING_AUTH_FILE='/tmp/woodbase-validation.htpasswd',WOOCOMMERCE_PLUGIN_DIR='/tmp/woodbase-validation-vendor',WP_CLI_PHAR='/tmp/woodbase-validation-cli',VITE_DIST_DIR='/tmp/woodbase-validation-dist')
p=root/'integrations/woocommerce/ops/adminvps-staging.yaml'
d=json.loads(subprocess.check_output(['docker','compose','-f',str(p),'config','--format','json'],env=env))
s=d['services'];assert set(s)=={'db','wordpress','web'}
assert not s['db'].get('ports') and not s['wordpress'].get('ports')
ports=s['web']['ports'];assert len(ports)==1 and ports[0]['host_ip']=='127.0.0.1' and ports[0]['published']=='8443' and ports[0]['target']==443
assert d['networks']['data']['internal'] and set(s['db']['networks'])=={'data'}
assert s['wordpress']['environment']['WB_ENVIRONMENT']=='staging'
assert s['wordpress']['environment']['WOODBASE_PUBLIC_ORIGIN']=='https://localhost:8443'
assert 'WOODBASE_FRONTEND_ORIGIN' in s['wordpress']['environment']['WORDPRESS_CONFIG_EXTRA']
for name in s:assert int(s[name]['mem_limit'])<=1073741824 and s[name]['logging']['options']['max-size']=='10m'
wp={v['target']:v for v in s['wordpress']['volumes']}
for target in ['/var/woodbase-private','/var/www/html','/var/www/html/wp-content/plugins/woodbase','/var/www/html/wp-content/mu-plugins/woodbase-staging.php']:assert target in wp
assert wp['/var/woodbase-private']['type']=='volume'
assert wp['/var/www/html/wp-content/plugins/woodbase']['source']==str(root/'integrations/woocommerce/plugin')
assert wp['/var/www/html/wp-content/mu-plugins/woodbase-staging.php']['read_only']
web={v['target']:v for v in s['web']['volumes']}
assert '/var/woodbase-private' not in web
assert web['/etc/nginx/woodbase/auth-forward.conf']['source'].endswith('staging-auth.conf')
assert web['/etc/nginx/woodbase/access.conf']['source'].endswith('staging-access.conf')
assert 'woodbase-adminvps-staging' in d['volumes']['private']['name']
print('PASS standalone staging: loopback TLS only, private DB/files, separate volumes, same origin, staging gate, bounded resources/logs, correct read-only release mounts')

# Optional parser/behavior validation against an existing LOCAL test container.
if '--php-container' in sys.argv:
 c=sys.argv[sys.argv.index('--php-container')+1]
 if not c.startswith('woodbase-local-'):raise SystemExit('Use an existing woodbase-local-* container only')
 for k in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(k,None)
 docker=['docker','--host=unix:///var/run/docker.sock']
 tag='/tmp/woodbase-staging-check-'+str(os.getpid())
 subprocess.run(docker+['exec',c,'mkdir','-p',tag],env=env,check=True)
 try:
  for name in ['bootstrap.php','staging-guard.php','php-fpm.conf']:
   subprocess.run(docker+['cp',str(root/'integrations/woocommerce/ops/adminvps'/name),c+':'+tag+'/'+name],env=env,check=True)
  subprocess.run(docker+['cp',str(root/'tests/adminvps-staging-guard.php'),c+':'+tag+'/test.php'],env=env,check=True)
  for name in ['bootstrap.php','staging-guard.php']:subprocess.run(docker+['exec',c,'php','-l',tag+'/'+name],env=env,check=True)
  subprocess.run(docker+['exec',c,'php',tag+'/test.php',tag+'/staging-guard.php'],env=env,check=True)
  result=subprocess.run(docker+['exec','-e','WB_GUARD_TEST_ENV=production',c,'php',tag+'/test.php',tag+'/staging-guard.php'],env=env,capture_output=True,text=True)
  assert result.returncode!=0 and 'Staging guard requires' in result.stderr+result.stdout
  print('PASS staging guard refuses production')
  pool='include=/usr/local/etc/php-fpm.conf\ninclude='+tag+'/php-fpm.conf\n'
  subprocess.run(docker+['exec','-i',c,'sh','-c','cat > '+tag+'/fpm.conf'],input=pool,text=True,env=env,check=True)
  subprocess.run(docker+['exec',c,'php-fpm','-t','-y',tag+'/fpm.conf'],env=env,check=True)
 finally:subprocess.run(docker+['exec',c,'rm','-rf',tag],env=env,check=True)
