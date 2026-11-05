#!/usr/bin/env python3
"""Local, repeatable setup. Never prints generated secrets or touches a remote WP."""
import os, pathlib, secrets, subprocess, time, zipfile
root=pathlib.Path(__file__).resolve().parents[2]
local=root/'integrations/woocommerce'
# PHP-FPM must read public plugin source even under a restrictive host umask.
(local/'plugin').chmod(0o755)
for source in (local/'plugin').glob('*.php'):source.chmod(0o644)
envfile=local/'.env'
if not envfile.exists():
 envfile.write_text(''.join(k+'='+secrets.token_hex(24)+'\n' for k in ['DB_PASSWORD','DB_ROOT_PASSWORD','WP_ADMIN_PASSWORD']))
 envfile.chmod(0o600)
values=dict(line.split('=',1) for line in envfile.read_text().splitlines() if line and not line.startswith('#'))
assets=root/'work/woocommerce-downloads';assets.mkdir(parents=True,exist_ok=True);assets.chmod(0o755)
def download(url,target):
 temporary=target.with_suffix(target.suffix+'.partial')
 subprocess.run(['curl','-fL','--max-time','120',url,'-o',str(temporary)],check=True)
 temporary.replace(target)
archive=assets/'woocommerce.zip'
if not archive.exists(): download('https://github.com/woocommerce/woocommerce/releases/download/10.3.5/woocommerce.zip',archive)
cli=assets/'wp-cli.phar'
if not cli.exists():download('https://github.com/wp-cli/wp-cli/releases/download/v2.12.0/wp-cli-2.12.0.phar',cli)
cli.chmod(0o644)
with zipfile.ZipFile(archive) as z:
 if 'Version: 10.3.5' not in z.read('woocommerce/woocommerce.php').decode(): raise RuntimeError('Unexpected WooCommerce release')
 for member in z.infolist():
  if not (assets/member.filename).resolve().is_relative_to(assets.resolve()): raise RuntimeError('Unsafe archive path')
 z.extractall(assets)
# Nginx and PHP run as different users; public vendor assets must be readable by both.
vendor=assets/'woocommerce';vendor.chmod(0o755)
for entry in vendor.rglob('*'):entry.chmod(0o755 if entry.is_dir() else 0o644)
compose=['docker','--host=unix:///var/run/docker.sock','compose','-f',str(local/'compose.yaml'),'--env-file',str(envfile)]
clean=os.environ.copy()
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:clean.pop(key,None)
subprocess.run(compose+['up','-d'],env=clean,check=True)
for _ in range(30):
 result=subprocess.run(compose+['exec','-T','wordpress','test','-f','/var/www/html/wp-load.php'],env=clean,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 if result.returncode==0:break
 time.sleep(1)
else:raise RuntimeError('WordPress did not initialize')
subprocess.run(compose+['exec','-T','wordpress','sh','-c','cp -a /opt/woodbase-downloads/woocommerce /var/www/html/wp-content/plugins/ && chown -R www-data:www-data /var/www/html/wp-content/plugins/woocommerce /var/woodbase-private && chmod 700 /var/woodbase-private'],env=clean,check=True)
clean['WB_ADMIN_PASSWORD']=values['WP_ADMIN_PASSWORD']
for _ in range(2):subprocess.run(compose+['exec','-T','-e','WB_ADMIN_PASSWORD','wordpress','php','/opt/woodbase-bootstrap.php'],env=clean,check=True)
print('Local WordPress ready: http://localhost:8088 ; credentials in ignored integrations/woocommerce/.env')
