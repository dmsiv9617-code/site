#!/usr/bin/env python3
"""Isolated Docker fixtures only; never reads a real htpasswd or contacts the VPS."""
import os,pathlib,subprocess,urllib.request,urllib.error,base64,tempfile,uuid,time
root=pathlib.Path(__file__).resolve().parents[1];env=os.environ.copy()
for k in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(k,None)
d=['docker','--host=unix:///var/run/docker.sock']
(root/'work').mkdir(exist_ok=True)
subprocess.run(d+['run','--rm','--network','none','-v',str(root)+':/check:ro','php:8.3-cli-alpine','php','/check/tests/basic-access-recovery.php'],env=env,check=True)
with tempfile.TemporaryDirectory(prefix='wb-basic-',dir=root/'work') as tmp:
 p=pathlib.Path(tmp);p.chmod(0o755);(p/'public').mkdir(mode=0o755);(p/'public').chmod(0o755);(p/'public/index.html').write_text('ok');(p/'public/index.html').chmod(0o644)
 (p/'nginx.conf').write_text('events {}\nhttp { server { listen 8080; location / { auth_basic "test"; auth_basic_user_file /auth; root /public; } } }');(p/'nginx.conf').chmod(0o644)
 php="define('WB_BASIC_ACCESS_LIBRARY',true);require '/check/scripts/recover-basic-access.php';$old='woodbase-reviewer:'.password_hash('old fixture only',PASSWORD_BCRYPT).\"\\n\";file_put_contents('/fixture/auth',$old);chmod('/fixture/auth',0640);chgrp('/fixture/auth',101);file_put_contents('/fixture/backup',$old);"
 subprocess.run(d+['run','--rm','--network','none','-v',str(root)+':/check:ro','-v',str(p)+':/fixture','php:8.3-cli-alpine','php','-r',php],env=env,check=True)
 name='wb-basic-recovery-'+uuid.uuid4().hex[:12]
 try:
  subprocess.run(d+['run','-d','--name',name,'-p','127.0.0.1::8080','-v',str(p/'nginx.conf')+':/etc/nginx/nginx.conf:ro','-v',str(p/'auth')+':/auth:ro','-v',str(p/'public')+':/public:ro','nginx:1.28-alpine'],env=env,check=True,stdout=subprocess.DEVNULL)
  port=subprocess.check_output(d+['port',name,'8080/tcp'],env=env,text=True).strip().rsplit(':',1)[1]
  def status(password=None):
   h={} if password is None else {'Authorization':'Basic '+base64.b64encode(('woodbase-reviewer:'+password).encode()).decode()}
   try:
    with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+port+'/',headers=h),timeout=5) as r:return r.status
   except urllib.error.HTTPError as e:return e.code
  for attempt in range(20):
   try:
    first=status();break
   except urllib.error.URLError:
    if attempt==19:raise
    time.sleep(.1)
  assert first==401
  assert status('old fixture only')==200
  reset="define('WB_BASIC_ACCESS_LIBRARY',true);require '/check/scripts/recover-basic-access.php';wb_basic_reset('/fixture/auth','/fixture/backup','woodbase-reviewer','New fixture passphrase 2026');"
  subprocess.run(d+['run','--rm','--network','none','-v',str(root)+':/check:ro','-v',str(p)+':/fixture','php:8.3-cli-alpine','php','-r',reset],env=env,check=True)
  assert status()==401
  assert status('old fixture only')==401
  assert status('New fixture passphrase 2026')==200
  print('PASS real Nginx: auth remains required, old password refused, new bcrypt password accepted with read-only mount')
 finally:subprocess.run(d+['rm','-f',name],env=env,check=True,stdout=subprocess.DEVNULL)
