#!/usr/bin/env python3
"""Local WooCommerce only. HTTP transport to Telegram is mocked by the PHP test."""
import os,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[1];env=os.environ.copy()
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
docker=['docker','--host=unix:///var/run/docker.sock'];container='woodbase-local-wordpress-1'
subprocess.run(docker+['exec',container,'php','-l','/var/www/html/wp-content/plugins/woodbase/telegram-order-bot.php'],env=env,check=True)
for source in ['woocommerce-order-checkout.php','woocommerce-telegram-bot.php']:
 target='woodbase-order-checkout-test.php' if source=='woocommerce-order-checkout.php' else source
 subprocess.run(docker+['cp',str(root/'tests'/source),container+':/tmp/'+target],env=env,check=True)
 subprocess.run(docker+['exec',container,'chmod','644','/tmp/'+target],env=env,check=True)
subprocess.run(docker+['exec','--user','www-data',container,'php','/tmp/woocommerce-telegram-bot.php'],env=env,check=True)
