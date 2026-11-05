<?php
if(PHP_SAPI!=='cli')exit(1);
$_SERVER['HTTP_HOST']='localhost:8088';$_SERVER['REQUEST_URI']='/';require '/var/www/html/wp-load.php';
if(wp_get_environment_type()!=='local'||!preg_match('/^[a-z0-9_]+_wb_test_[a-f0-9]+_$/D',$argv[1]??''))exit(2);
$s=new WB_State($argv[1],$argv[2],null,['owner_files'=>2,'owner_bytes'=>128,'total_bytes'=>512,'reserve_bytes'=>64]);
try{$s->upload(hash('sha256','parallel-owner'),function($path){file_put_contents($path,'file');return ['width'=>1,'height'=>1];});echo 'reserved';exit(0);}catch(WB_Problem $e){if($e->status===429)exit(10);exit(2);}
