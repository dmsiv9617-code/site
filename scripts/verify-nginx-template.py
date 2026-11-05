#!/usr/bin/env python3
"""Validate an isolated Nginx process and locally trusted TLS without reloading the running site."""
import pathlib,subprocess,tempfile,json,os,secrets,time
root=pathlib.Path(__file__).resolve().parents[1];work=root/'work';work.mkdir(exist_ok=True)
env=os.environ.copy()
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
docker=['docker','--host=unix:///var/run/docker.sock'];container='woodbase-local-web-1'
tag='/tmp/woodbase-nginx-'+secrets.token_hex(5)
started=False
with tempfile.TemporaryDirectory(dir=work,prefix='nginx-check-') as tmp:
 tmp=pathlib.Path(tmp)
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=woodbase.test','-addext','subjectAltName=DNS:woodbase.test','-keyout',str(tmp/'privkey.pem'),'-out',str(tmp/'fullchain.pem')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 site=(root/'integrations/woocommerce/ops/nginx/site.conf.template').read_text().replace('${WOODBASE_DOMAIN}','woodbase.test').replace('listen 80;','listen 18080;').replace('listen 443 ssl;','listen 18443 ssl;').replace('/etc/woodbase-tls',tag).replace('/etc/nginx/woodbase/access.conf',tag+'/access.conf').replace('/etc/nginx/woodbase/auth-forward.conf',tag+'/auth-forward.conf').replace('/var/log/nginx/access.log',tag+'/access.log')
 (tmp/'auth-forward.conf').write_text('fastcgi_param HTTP_AUTHORIZATION $http_authorization;\n')
 site=site.replace(' location = /index.html', ' location = /__wb_upstream_failure_test { include /etc/nginx/fastcgi_params; fastcgi_pass 127.0.0.1:1; }\n location = /index.html')
 (tmp/'site.conf').write_text(site);(tmp/'access.conf').write_text('# local TLS probe, no public domain\n')
 (tmp/'nginx.conf').write_text('pid '+tag+'/nginx.pid;\nerror_log stderr;\nevents {}\nhttp { include /etc/nginx/mime.types; access_log off; include '+tag+'/site.conf; }\n')
 subprocess.run(docker+['exec',container,'mkdir','-p',tag],env=env,check=True)
 try:
  subprocess.run(docker+['cp',str(tmp)+'/.',container+':'+tag],env=env,check=True)
  subprocess.run(docker+['exec',container,'chmod','755',tag],env=env,check=True)
  subprocess.run(docker+['exec',container,'nginx','-t','-c',tag+'/nginx.conf'],env=env,check=True)
  subprocess.run(docker+['exec',container,'nginx','-c',tag+'/nginx.conf'],env=env,check=True);started=True
  networks=json.loads(subprocess.check_output(docker+['inspect','--format','{{json .NetworkSettings.Networks}}',container],env=env))
  ip=next(iter(networks.values()))['IPAddress']
  result=subprocess.run(['curl','--noproxy','woodbase.test','--resolve','woodbase.test:18443:'+ip,'--cacert',str(tmp/'fullchain.pem'),'-sS','-D','-','https://woodbase.test:18443/wp-json/woodbase/v1/session'],env=env,check=True,capture_output=True,text=True)
  header=result.stdout.split('\r\n\r\n')[0].lower();assert '200 ok' in header and 'cache-control: no-store, private' in header
  cookie=next(line for line in result.stdout.splitlines() if line.lower().startswith('set-cookie: wp_woocommerce_session_'))
  assert all(x in cookie.lower() for x in ['secure','httponly','samesite=lax'])
  print('PASS Nginx syntax, TLS verified with a local CA/SAN, no-store response, WC cookie Secure/HttpOnly/SameSite=Lax')
  unavailable=subprocess.run(['curl','--noproxy','woodbase.test','--resolve','woodbase.test:18443:'+ip,'--cacert',str(tmp/'fullchain.pem'),'-sS','-w','\n%{http_code}','https://woodbase.test:18443/__wb_upstream_failure_test'],env=env,check=True,capture_output=True,text=True)
  assert unavailable.stdout.endswith('503') and 'wb_unavailable' in unavailable.stdout
  print('PASS unavailable FastCGI upstream returns safe 503 JSON')
  password=secrets.token_hex(16)
  hashed=subprocess.check_output(['openssl','passwd','-apr1','-stdin'],input=password,text=True).strip()
  (tmp/'htpasswd').write_text('staging-check:'+hashed+'\n')
  (tmp/'access.conf').write_text('auth_basic "WoodBase staging"; auth_basic_user_file '+tag+'/htpasswd;\n')
  (tmp/'auth-forward.conf').write_text('fastcgi_param HTTP_AUTHORIZATION "";\n')
  for name in ['htpasswd','access.conf','auth-forward.conf']:subprocess.run(docker+['cp',str(tmp/name),container+':'+tag+'/'+name],env=env,check=True)
  subprocess.run(docker+['exec',container,'chmod','644',tag+'/htpasswd'],env=env,check=True)
  subprocess.run(docker+['exec',container,'nginx','-s','reload','-c',tag+'/nginx.conf'],env=env,check=True)
  probe=['curl','--noproxy','woodbase.test','--resolve','woodbase.test:18443:'+ip,'--cacert',str(tmp/'fullchain.pem'),'-sS','-o','/dev/null','-w','%{http_code}','https://woodbase.test:18443/wp-json/woodbase/v1/session']
  for _ in range(20):
   if subprocess.check_output(probe,env=env,text=True)=='401':break
   time.sleep(.05)
  else:raise RuntimeError('Staging access restriction did not activate')
  for _ in range(20):
   status=subprocess.check_output(probe+['--user','staging-check:'+password],env=env,text=True)
   if status=='200':break
   time.sleep(.05)
  else:raise RuntimeError('Staging authenticated probe returned HTTP '+status)
  print('PASS staging Basic gate rejects anonymous access and does not forward Basic credentials into WP REST authentication')
  print('LIMITATION: woodbase.test resolves locally; no public DNS/domain deployment or public HTTPS purchase flow was tested')
 finally:
  if started:subprocess.run(docker+['exec',container,'nginx','-s','quit','-c',tag+'/nginx.conf'],env=env,check=True)
  subprocess.run(docker+['exec',container,'rm','-rf',tag],env=env,check=True)
