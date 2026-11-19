#!/usr/bin/env python3
"""Only use the local Compose container; never connect to the VPS."""
import os,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[1];env=os.environ.copy()
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
docker=['docker','--host=unix:///var/run/docker.sock'];container='woodbase-local-wordpress-1'
for source in ['woodbase.php','order-checkout.php','extras-pricing.php','hardening.php']:
 subprocess.run(docker+['exec',container,'php','-l','/var/www/html/wp-content/plugins/woodbase/'+source],env=env,check=True)
subprocess.run(docker+['cp',str(root/'tests/woocommerce-order-checkout.php'),container+':/tmp/woodbase-order-checkout-test.php'],env=env,check=True)
subprocess.run(docker+['exec',container,'chmod','644','/tmp/woodbase-order-checkout-test.php'],env=env,check=True)
subprocess.run(docker+['exec','--user','www-data',container,'php','/tmp/woodbase-order-checkout-test.php'],env=env,check=True)
