#!/usr/bin/env python3
"""Run lifecycle tests on isolated tables/directories and read-only order assertions on local WP."""
import os,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[1];env=os.environ.copy()
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
docker=['docker','--host=unix:///var/run/docker.sock'];container='woodbase-local-wordpress-1'
files={'woocommerce-hardening.php':'woodbase-hardening-test.php','woocommerce-hardening-worker.php':'woodbase-hardening-worker.php','woocommerce-server.php':'woodbase-server-test.php'}
for source,target in files.items():subprocess.run(docker+['cp',str(root/'tests'/source),container+':/tmp/'+target],env=env,check=True)
for source in ['woodbase.php','hardening.php','state.php']:subprocess.run(docker+['exec',container,'php','-l','/var/www/html/wp-content/plugins/woodbase/'+source],env=env,check=True)
for test in ['woodbase-hardening-test.php','woodbase-server-test.php']:subprocess.run(docker+['exec',container,'php','/tmp/'+test],env=env,check=True)
