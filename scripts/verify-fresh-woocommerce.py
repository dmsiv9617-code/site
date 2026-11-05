#!/usr/bin/env python3
"""Test first installation on disposable local volumes, never existing project volumes."""
import os, pathlib, subprocess, time
root=pathlib.Path(__file__).resolve().parents[1]
local=root/'integrations/woocommerce'
if not (local/'.env').exists() or not (root/'work/woocommerce-downloads/woocommerce/woocommerce.php').exists():
 raise SystemExit('Run the local setup first to prepare credentials and the pinned Woo archive')
values=dict(line.split('=',1) for line in (local/'.env').read_text().splitlines() if line and not line.startswith('#'))
env=os.environ.copy()
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
env['WB_ADMIN_PASSWORD']=values['WP_ADMIN_PASSWORD']
project='woodbase-review-fresh'
cmd=['docker','--host=unix:///var/run/docker.sock','compose','-p',project,'-f',str(local/'compose.yaml'),'--env-file',str(local/'.env')]
existing=subprocess.run(cmd+['ps','-aq'],env=env,text=True,capture_output=True,check=True)
volumes=subprocess.run(['docker','--host=unix:///var/run/docker.sock','volume','ls','-q','--filter','label=com.docker.compose.project='+project],env=env,text=True,capture_output=True,check=True)
if existing.stdout.strip() or volumes.stdout.strip():raise SystemExit('Refusing to reuse or delete existing review containers/volumes')
def run(*args):subprocess.run(cmd+list(args),env=env,check=True)
try:
 # No web service or published port: both existing Vite/WP and their volumes stay intact.
 run('up','-d','db','wordpress')
 for _ in range(30):
  result=subprocess.run(cmd+['exec','-T','wordpress','test','-f','/var/www/html/wp-load.php'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  if result.returncode==0:break
  time.sleep(1)
 else:raise RuntimeError('Fresh WordPress initialization timed out')
 run('exec','-T','wordpress','sh','-c','cp -a /opt/woodbase-downloads/woocommerce /var/www/html/wp-content/plugins/ && chown -R www-data:www-data /var/www/html/wp-content/plugins/woocommerce /var/woodbase-private && chmod 700 /var/woodbase-private')
 for _ in range(2):run('exec','-T','-e','WB_ADMIN_PASSWORD','wordpress','php','/opt/woodbase-bootstrap.php')
 check='''$_SERVER["HTTP_HOST"]="localhost:8088";require "/var/www/html/wp-load.php";
 if(!function_exists("wb_options") || !is_blog_installed())throw new Exception("Plugin or WordPress not installed");
 $p=wc_get_product((int)get_option("wb_product_id"));
 if(!$p || $p->get_price()!=="3540")throw new Exception("Test product missing");
 $page=get_post((int)get_option("woocommerce_checkout_page_id"));
 if(get_option("woocommerce_coming_soon")!=="no")throw new Exception("Coming Soon blocks guest checkout");
 if(!$page || !has_shortcode($page->post_content,"woocommerce_checkout"))throw new Exception("Classic checkout missing");
 echo "PASS fresh two-phase installation: WP, Woo, WoodBase plugin, one seed product and classic checkout\\n";'''
 run('exec','-T','wordpress','php','-r',check)
except Exception:
 logs=subprocess.run(cmd+['logs','--no-color','--tail','100','db','wordpress'],env=env,text=True,capture_output=True)
 diagnostic=logs.stdout+logs.stderr
 for value in values.values():
  if value:diagnostic=diagnostic.replace(value,'<redacted>')
 (root/'work/fresh-install-diagnostic.log').write_text(diagnostic)
 print('Fresh-install diagnostic saved in work/fresh-install-diagnostic.log')
 raise
finally:
 # Only resources of the initially empty disposable project are removed.
 run('down','-v','--remove-orphans')
