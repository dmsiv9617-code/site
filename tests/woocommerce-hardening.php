<?php
if(PHP_SAPI!=='cli')exit(1);
$_SERVER['HTTP_HOST']='localhost:8088';$_SERVER['REQUEST_URI']='/';
require '/var/www/html/wp-load.php';
if(wp_get_environment_type()!=='local')throw new Exception('Local tests only');
function hard_check($ok,$message){if(!$ok)throw new Exception($message);}
hard_check(class_exists('WB_State'),'Lifecycle/quota store must exist');
$prefix=$wpdb->prefix.'wb_test_'.bin2hex(random_bytes(4)).'_';
$dir=sys_get_temp_dir().'/'.$prefix;mkdir($dir,0700);
$now=time();$clock=function()use(&$now){return $now;};
$s=new WB_State($prefix,$dir,$clock,['owner_files'=>2,'owner_bytes'=>128,'total_bytes'=>512,'reserve_bytes'=>64]);
$s->install();
try {
 $owner=hash('sha256','test-owner');
 $fail=false;
 try{$s->upload($owner,function($path){file_put_contents($path,'partial');throw new RuntimeException('processor failure');});}catch(Throwable $e){$fail=true;}
 hard_check($fail && $s->usage($owner)['count']===0,'Failed processing must free reservation and partial file');
 $a=$s->upload($owner,function($path){file_put_contents($path,'file-a');return ['width'=>1,'height'=>1];});
 $b=$s->upload($owner,function($path){file_put_contents($path,'file-b');return ['width'=>1,'height'=>1];});
 hard_check($s->usage($owner)['count']===2,'Quota must count successful files');
 $rejected=false;try{$s->reserve($owner);}catch(WB_Problem $e){$rejected=$e->status===429;}
 hard_check($rejected,'Storage quota must reject overflow');
 $s->cart($a['fileId'],$owner,'cart-line', $now+172800);
 $s->protect($b['fileId'],'pending-order','pending');
 $s->order($b['fileId'],123,'pending-order');$s->reviewOrder(123,1);
 $now+=90000;
 $dry=$s->cleanup(true,100);hard_check($dry['assets']===0,'Cart lease and order hold must protect old files');
 $s->detach($a['fileId'],'cart-line');$now+=90000;
 $dry=$s->cleanup(true,100);hard_check($dry['assets']===1 && is_file($s->path($a['fileId'])),'Dry-run must not delete eligible orphan');
 $s->lock('asset:'.$a['fileId'],0);
 $dbLocked=new wpdb(DB_USER,DB_PASSWORD,DB_NAME,DB_HOST);$contender=new WB_State($prefix,$dir,$clock,[],$dbLocked);
 hard_check($contender->cleanup(false,100)['assets']===0 && is_file($s->path($a['fileId'])),'Cleanup must skip an asset held by another connection');
 $s->unlock('asset:'.$a['fileId']);$dbLocked->close();
 $deleted=$s->cleanup(false,100);hard_check($deleted['assets']===1 && !file_exists($s->path($a['fileId'])),'Cleanup must remove orphan and release quota');
 hard_check(is_file($s->path($b['fileId'])),'Order artwork must never be age-deleted');
 hard_check($s->cleanup(false,100)['assets']===0,'Cleanup must be repeat-safe');
 hard_check($s->lock('cleanup',0),'Test must acquire cleanup lock');
 // A different DB connection exercises the actual MariaDB advisory lock.
 $wpdb->query('SELECT RELEASE_ALL_LOCKS()'); // Simulate loss of DB advisory locks; OS guard must still protect cleanup.
 $db2=new wpdb(DB_USER,DB_PASSWORD,DB_NAME,DB_HOST);
 $other=new WB_State($prefix,$dir,$clock,[],$db2);
 hard_check($other->cleanup(false,100)['busy']===true,'Concurrent cleanup must be refused');
 $s->unlock('cleanup');$db2->close();
 $workers=[];
 for($i=0;$i<6;$i++){
  $process=proc_open([PHP_BINARY,'/tmp/woodbase-hardening-worker.php',$prefix,$dir],[0=>['file','/dev/null','r'],1=>['file','/dev/null','w'],2=>['file','/dev/null','w']],$pipes);$workers[]=$process;
 }
 $codes=array_map('proc_close',$workers);
 hard_check(count(array_filter($codes,fn($code)=>$code===0))===2 && count(array_filter($codes,fn($code)=>$code===10))===4,'Parallel quota reservations must allow exactly two files');
 $legacy=bin2hex(random_bytes(16));file_put_contents($s->path($legacy),'legacy');$s->importLegacy($legacy,['owner'=>$owner,'created'=>1]);
 hard_check($s->asset($legacy)['hold']==1,'Legacy files must be protected, not treated as old orphans');
 $s->receipt($owner,'same-request');$repeat=false;
 try{$s->receipt($owner,'same-request');}catch(WB_Problem $e){$repeat=$e->status===409;}
 hard_check($repeat,'Repeat request must be a conflict');
 for($i=0;$i<2;$i++)$s->rate('test-scope',2,60);
 $limited=false;try{$s->rate('test-scope',2,60);}catch(WB_Problem $e){$limited=$e->status===429 && $e->retry>0;}
 hard_check($limited,'Rate limit must produce 429 and Retry-After');
 $now+=300000;$s->cleanup(false,100);
 hard_check($s->counts()['receipts']===0 && $s->counts()['rates']===0,'Expired service rows must be bounded and cleaned');
 hard_check(is_file($s->path($b['fileId'])),'Orders must survive every maintenance pass');
 hard_check(wb_client_ip(['REMOTE_ADDR'=>'198.51.100.2','HTTP_X_FORWARDED_FOR'=>'1.2.3.4'],[])==='198.51.100.2','Untrusted XFF must be ignored');
 hard_check(wb_client_ip(['REMOTE_ADDR'=>'10.0.0.2','HTTP_X_FORWARDED_FOR'=>'198.51.100.9, 10.0.0.3'],['10.0.0.0/8'])==='198.51.100.9','Trusted proxy chain must choose last untrusted hop');
 echo "PASS failed upload rollback, quotas, orphan TTL, cart lease, immutable order hold, dry-run, repeat cleanup, concurrent cleanup, replay, rates, expiry and proxy IP\n";
} finally {
 hard_check((bool)preg_match('/^[a-z0-9_]+_wb_test_[a-f0-9]+_$/D',$prefix),'Test cleanup prefix guard');
 foreach(['refs','assets','receipts','rates'] as $table)$wpdb->query('DROP TABLE '.$prefix.$table);
 foreach(glob($dir.'/*') as $file)unlink($file);
 foreach(glob($dir.'/.locks/*') as $file)unlink($file);if(is_dir($dir.'/.locks'))rmdir($dir.'/.locks');rmdir($dir);
}
