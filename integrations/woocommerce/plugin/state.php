<?php
if(!defined('ABSPATH'))exit;
final class WB_Problem extends RuntimeException {
 public $status;public $retry;
 public function __construct($message,$status=400,$retry=0){parent::__construct($message);$this->status=$status;$this->retry=$retry;}
}
/** DB metadata is authoritative. All deletion/link transitions take the same asset lock. */
final class WB_State {
 private $db,$prefix,$root,$clock,$cfg;
 private $fileLocks=[];
 public function __construct($prefix,$root,$clock=null,$config=[],$database=null) {
  global $wpdb;
  if(!preg_match('/^[a-zA-Z0-9_]+$/D',$prefix))throw new InvalidArgumentException('Invalid table prefix');
  $this->db=$database?:$wpdb;$this->db->suppress_errors(true);$this->prefix=$prefix;$this->root=rtrim($root,'/');$this->clock=$clock?:fn()=>time();
  $this->cfg=$config+['total_files'=>10000,'owner_files'=>10,'owner_bytes'=>50*1024*1024,'total_bytes'=>512*1024*1024,'reserve_bytes'=>20*1024*1024,'temporary_ttl'=>86400,'session_ttl'=>172800,'receipt_ttl'=>259200];
  foreach($this->cfg as $key=>$value){if(filter_var($value,FILTER_VALIDATE_INT)===false||(int)$value<1)throw new WB_Problem('Сервис временно недоступен: проверьте настройки лимитов.',503);$this->cfg[$key]=(int)$value;}
  if($this->cfg['owner_bytes']<$this->cfg['reserve_bytes']||$this->cfg['total_bytes']<$this->cfg['reserve_bytes'])throw new WB_Problem('Сервис временно недоступен: проверьте настройки лимитов.',503);
  $this->cfg['session_ttl']=max(3600,$this->cfg['session_ttl']);
  $this->cfg['receipt_ttl']=max($this->cfg['receipt_ttl'],$this->cfg['session_ttl']+86400);
 }
 public function now(){return ($this->clock)();}
 private function table($name){return $this->prefix.$name;}
 private function sql($query){$r=$this->db->query($query);if($r===false)throw new WB_Problem('Хранилище временно недоступно. Повторите позже.',503);return $r;}
 private function checkedRead($method,$query,$array=false){
  $result=$array?$this->db->$method($query,ARRAY_A):$this->db->$method($query);
  if($this->db->last_error)throw new WB_Problem('Хранилище временно недоступно. Повторите позже.',503);
  return $result;
 }
 private function value($q){return $this->checkedRead('get_var',$q);}
 private function row($q,$format=ARRAY_A){return $this->checkedRead('get_row',$q,true);}
 private function column($q){return $this->checkedRead('get_col',$q);}
 private function rows($q,$format=ARRAY_A){return $this->checkedRead('get_results',$q,true);}
 public function install(){
  require_once ABSPATH.'wp-admin/includes/upgrade.php';
  $charset=$this->db->get_charset_collate();$p=$this->prefix;
  $schema=[
   "CREATE TABLE {$p}assets (id char(32) NOT NULL, owner char(64) NOT NULL, state varchar(16) NOT NULL, bytes bigint unsigned NOT NULL, created bigint unsigned NOT NULL, expires bigint unsigned NOT NULL, hold tinyint NOT NULL DEFAULT 0, PRIMARY KEY  (id), KEY expiry (hold,expires), KEY owner (owner)) ENGINE=InnoDB $charset;",
   "CREATE TABLE {$p}refs (asset char(32) NOT NULL, kind varchar(12) NOT NULL, ref_key char(64) NOT NULL, object_id bigint unsigned NOT NULL DEFAULT 0, expires bigint unsigned NOT NULL, PRIMARY KEY  (asset,kind,ref_key), KEY expiry (kind,expires)) ENGINE=InnoDB $charset;",
   "CREATE TABLE {$p}receipts (id char(64) NOT NULL, expires bigint unsigned NOT NULL, PRIMARY KEY  (id), KEY expiry (expires)) ENGINE=InnoDB $charset;",
   "CREATE TABLE {$p}rates (id char(64) NOT NULL, window_start bigint unsigned NOT NULL, hits bigint unsigned NOT NULL, expires bigint unsigned NOT NULL, PRIMARY KEY  (id,window_start), KEY expiry (expires)) ENGINE=InnoDB $charset;",
  ];
  // dbDelta uses the global connection. Tests install before swapping their connection.
  foreach($schema as $query)dbDelta(str_replace(", ",",\n",$query));
  foreach(['assets','refs','receipts','rates'] as $name)if($this->value($this->db->prepare('SHOW TABLES LIKE %s',$this->table($name)))!==$this->table($name))throw new WB_Problem('Не удалось подготовить хранилище.',503);
  if(!$this->row('SHOW COLUMNS FROM '.$this->table('refs')." LIKE 'object_id'"))throw new WB_Problem('Не удалось обновить хранилище.',503);
 }
 private function lockName($key){return 'wb_'.substr(hash('sha256',$this->prefix.':'.$key),0,60);}
 // Fixed stripes bound lock-file count. OS locks survive a DB reconnect and release on process death.
 private function stripe($key){return ['quota'=>0,'cleanup'=>1,'schema'=>2][$key]??(3+(hexdec(substr(hash('sha256',$key),0,6))%253));}
 public function lock($key,$wait=0){
  $slot=$this->stripe($key);$dir=$this->root.'/.locks';
  if(!isset($this->fileLocks[$slot])){
   if(!is_dir($dir)&&!@mkdir($dir,0700,true)&&!is_dir($dir))throw new WB_Problem('Хранилище блокировок недоступно.',503);
   // Root-run WP-CLI must leave locks usable by the PHP filesystem owner.
   $owner=fileowner($this->root);$group=filegroup($this->root);
   if(fileowner($dir)!==$owner)@chown($dir,$owner);if(filegroup($dir)!==$group)@chgrp($dir,$group);
   $handle=@fopen($dir.'/'.$slot.'.lock','c');if(!$handle)throw new WB_Problem('Хранилище блокировок недоступно.',503);
   @chown($dir.'/'.$slot.'.lock',$owner);@chgrp($dir.'/'.$slot.'.lock',$group);
   chmod($dir.'/'.$slot.'.lock',0600);$until=microtime(true)+$wait;
   do{if(flock($handle,LOCK_EX|LOCK_NB))break;if(microtime(true)>=$until){fclose($handle);return false;}usleep(50000);}while(true);
   $this->fileLocks[$slot]=['handle'=>$handle,'count'=>0];
  }
  try{$got=(int)$this->value($this->db->prepare('SELECT GET_LOCK(%s,%d)',$this->lockName($key),$wait))===1;}
  catch(Throwable $e){if($this->fileLocks[$slot]['count']===0){flock($this->fileLocks[$slot]['handle'],LOCK_UN);fclose($this->fileLocks[$slot]['handle']);unset($this->fileLocks[$slot]);}throw $e;}
  if(!$got){if($this->fileLocks[$slot]['count']===0){flock($this->fileLocks[$slot]['handle'],LOCK_UN);fclose($this->fileLocks[$slot]['handle']);unset($this->fileLocks[$slot]);}return false;}
  $this->fileLocks[$slot]['count']++;return true;
 }
 public function unlock($key){
  $slot=$this->stripe($key);
  try{$this->value($this->db->prepare('SELECT RELEASE_LOCK(%s)',$this->lockName($key)));}
  finally{if(isset($this->fileLocks[$slot])&&--$this->fileLocks[$slot]['count']===0){flock($this->fileLocks[$slot]['handle'],LOCK_UN);fclose($this->fileLocks[$slot]['handle']);unset($this->fileLocks[$slot]);}}
 }
 private function locked($key,$fn){if(!$this->lock($key,3))throw new WB_Problem('Операция уже выполняется. Повторите позже.',409);try{return $fn();}finally{$this->unlock($key);}}
 public function path($id){if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id))throw new WB_Problem('Некорректный идентификатор макета.',400);return $this->root.'/'.$id.'.png';}
 public function asset($id){$this->path($id);return $this->row($this->db->prepare('SELECT * FROM '.$this->table('assets').' WHERE id=%s',$id),ARRAY_A);}
 public function counts(){ $r=[];foreach(['assets','refs','receipts','rates'] as $name)$r[$name]=(int)$this->value('SELECT COUNT(*) FROM '.$this->table($name));return $r; }
 public function usage($owner){
  $row=$this->row($this->db->prepare('SELECT COUNT(*) AS count, COALESCE(SUM(bytes),0) AS bytes FROM '.$this->table('assets').' WHERE owner=%s AND hold=0',$owner),ARRAY_A);
  return ['count'=>(int)$row['count'],'bytes'=>(int)$row['bytes']];
 }
 public function reserve($owner){return $this->locked('quota',function()use($owner){
  $usage=$this->usage($owner);$max=$this->cfg['reserve_bytes'];
  $inflight=(int)$this->value("SELECT COUNT(*) FROM ".$this->table('assets')." WHERE state='reserved'");
  $working=max($max,64*1024*1024); // 16M decoded pixels may temporarily encode above the accepted 20 MiB.
  if(disk_free_space($this->root)<$working*($inflight+1)+64*1024*1024)throw new WB_Problem('На сервере недостаточно места для макета.',503);
  $total=(int)$this->value('SELECT COALESCE(SUM(bytes),0) FROM '.$this->table('assets'));
  if($usage['count']>=$this->cfg['owner_files'] || $usage['bytes']+$max>$this->cfg['owner_bytes'])throw new WB_Problem('Лимит временных макетов исчерпан. Удалите лишние файлы или повторите позже.',429,300);
  $totalFiles=(int)$this->value('SELECT COUNT(*) FROM '.$this->table('assets'));
  if($totalFiles>=$this->cfg['total_files']||$total+$max>$this->cfg['total_bytes'])throw new WB_Problem('Хранилище макетов заполнено. Обратитесь в мастерскую.',503);
  $id=bin2hex(random_bytes(16));$now=$this->now();
  $this->sql($this->db->prepare('INSERT INTO '.$this->table('assets').' (id,owner,state,bytes,created,expires,hold) VALUES (%s,%s,%s,%d,%d,%d,0)',$id,$owner,'reserved',$max,$now,$now+900));
  return $id;
 });}
 public function upload($owner,$processor){
  if(!is_dir($this->root)||!is_writable($this->root))throw new WB_Problem('Хранилище макетов недоступно.',503);
  $id=$this->reserve($owner);$path=$this->path($id);
  try{return $this->locked('asset:'.$id,function()use($id,$path,$processor){
   $info=$processor($path);clearstatcache(true,$path);
   if(!is_file($path)||is_link($path))throw new WB_Problem('Не удалось сохранить рисунок.',503);
   $bytes=filesize($path);
   if($bytes>$this->cfg['reserve_bytes'])throw new WB_Problem('После обработки изображение слишком большое. Уменьшите разрешение.',413);
   if(!chmod($path,0600))throw new WB_Problem('Не удалось защитить рисунок.',503);
   $this->sql($this->db->prepare('UPDATE '.$this->table('assets').' SET state=%s,bytes=%d,expires=%d WHERE id=%s','temporary',$bytes,$this->now()+$this->cfg['temporary_ttl'],$id));
   return ['fileId'=>$id,'width'=>$info['width'],'height'=>$info['height']];
  });}catch(Throwable $e){
   // The reservation is not externally visible until upload succeeds.
   $this->locked('asset:'.$id,function()use($id,$path){
    if(file_exists($path)&&!unlink($path))return; // Keep accounting if cleanup must retry an unlink failure.
    $this->sql($this->db->prepare('DELETE FROM '.$this->table('assets').' WHERE id=%s AND hold=0',$id));
   });
   throw $e;
  }
 }
 public function owned($id,$owner){return $this->locked('asset:'.$id,function()use($id,$owner){
  $row=$this->asset($id);
  if(!$row && $this->prefix===$this->db->prefix.'wb_' && ($legacy=get_option('wb_file_'.$id))) {$this->importLegacy($id,(array)$legacy);$row=$this->asset($id);delete_option('wb_file_'.$id);}
  if(!$row||!is_file($this->path($id))||is_link($this->path($id)))throw new WB_Problem('Макет не найден. Загрузите оригинал снова.',404);
  if(!hash_equals($row['owner'],$owner))throw new WB_Problem('Нет доступа к этому макету.',403);
  return $row;
 });}
 public function cart($id,$owner,$ref,$expires=null){return $this->locked('asset:'.$id,function()use($id,$owner,$ref,$expires){
  $row=$this->owned($id,$owner);$until=$expires??($this->now()+$this->cfg['session_ttl']);
  $this->sql($this->db->prepare('INSERT INTO '.$this->table('refs').' (asset,kind,ref_key,expires) VALUES (%s,%s,%s,%d) ON DUPLICATE KEY UPDATE expires=GREATEST(expires,VALUES(expires))',$id,'cart',hash('sha256',$ref),$until));
  $this->sql($this->db->prepare('UPDATE '.$this->table('assets').' SET state=IF(hold=1,state,%s),expires=IF(hold=1,expires,GREATEST(expires,%d)) WHERE id=%s','cart',$until,$id));
 });}
 public function detach($id,$ref){$this->locked('asset:'.$id,function()use($id,$ref){
  $this->sql($this->db->prepare('DELETE FROM '.$this->table('refs').' WHERE asset=%s AND kind=%s AND ref_key=%s',$id,'cart',hash('sha256',$ref)));
  $active=(int)$this->value($this->db->prepare('SELECT MAX(expires) FROM '.$this->table('refs')." WHERE asset=%s AND kind='cart' AND expires>=%d",$id,$this->now()));
  $this->sql($this->db->prepare('UPDATE '.$this->table('assets').' SET expires=IF(hold=1,0,%d),state=IF(hold=1,state,%s) WHERE id=%s',$active?:($this->now()+$this->cfg['temporary_ttl']),$active?'cart':'temporary',$id));

 });}
 public function protect($id,$ref,$kind='order',$objectId=0){$this->locked('asset:'.$id,function()use($id,$ref,$kind,$objectId){
  if(!$this->asset($id)||!is_file($this->path($id)))throw new WB_Problem('Макет не найден. Загрузите оригинал снова.',404);
  $this->sql($this->db->prepare('UPDATE '.$this->table('assets').' SET hold=1,state=%s,expires=0 WHERE id=%s','order',$id));
  $this->sql($this->db->prepare('INSERT INTO '.$this->table('refs').' (asset,kind,ref_key,object_id,expires) VALUES (%s,%s,%s,%d,0) ON DUPLICATE KEY UPDATE expires=0,object_id=GREATEST(object_id,VALUES(object_id))',$id,$kind,hash('sha256',$ref),$objectId));
 });}
 public function order($id,$orderId,$pending){$this->locked('asset:'.$id,function()use($id,$orderId,$pending){
  $this->protect($id,'order:'.$orderId,'order',(int)$orderId);
  $this->sql($this->db->prepare('DELETE FROM '.$this->table('refs').' WHERE asset=%s AND kind=%s AND ref_key=%s',$id,'pending',hash('sha256',$pending)));
 });}
 // A retention setting creates a review date only. Holds/order refs never become deletion permission.
 public function reviewOrder($orderId,$days){
  $this->sql($this->db->prepare('UPDATE '.$this->table('refs').' SET expires=%d WHERE kind=%s AND ref_key=%s',$days>0?$this->now()+$days*86400:0,'order',hash('sha256','order:'.$orderId)));
 }
 public function receipt($owner,$request){$this->sql($this->db->prepare('DELETE FROM '.$this->table('receipts').' WHERE expires<%d LIMIT 20',$this->now()));$this->receiptHash(hash('sha256',$owner.':'.$request),$this->now()+$this->cfg['receipt_ttl']);}
 private function receiptHash($hash,$expires){
  $ok=$this->sql($this->db->prepare('INSERT IGNORE INTO '.$this->table('receipts').' (id,expires) VALUES (%s,%d)',$hash,$expires));
  if(!$ok)throw new WB_Problem('Запрос уже получен. Обновите корзину перед повтором.',409);
 }
 public function rate($scope,$limit,$seconds){
  $now=$this->now();$window=intdiv($now,$seconds)*$seconds;$hash=hash_hmac('sha256',$scope,wp_salt('auth'));
  // Incremental expiry even when WP-Cron is unavailable; bounded work per request.
  $this->sql($this->db->prepare('DELETE FROM '.$this->table('rates').' WHERE expires<%d LIMIT 20',$now));
  $this->sql($this->db->prepare('INSERT INTO '.$this->table('rates').' (id,window_start,hits,expires) VALUES (%s,%d,1,%d) ON DUPLICATE KEY UPDATE hits=hits+1',$hash,$window,$window+2*$seconds));
  $hits=(int)$this->value($this->db->prepare('SELECT hits FROM '.$this->table('rates').' WHERE id=%s AND window_start=%d',$hash,$window));
  if($hits>$limit)throw new WB_Problem('Слишком много запросов. Повторите через минуту.',429,max(1,$window+$seconds-$now));
 }
 public function importLegacy($id,$meta){
  if(!$this->asset($id))$this->sql($this->db->prepare('INSERT IGNORE INTO '.$this->table('assets').' (id,owner,state,bytes,created,expires,hold) VALUES (%s,%s,%s,%d,%d,0,1)',$id,(string)($meta['owner']??''),'legacy',is_file($this->path($id))?filesize($this->path($id)):0,(int)($meta['created']??$this->now())));
 }
 public function migrate($batch=100,$dry=false){
  if($this->prefix!==$this->db->prefix.'wb_')return 0;
  $options=$this->db->prefix.'options';$like=$this->db->esc_like('wb_');
  $rows=$this->rows($this->db->prepare("SELECT option_name FROM $options WHERE option_name LIKE %s AND (option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s) ORDER BY option_id LIMIT %d",$like.'%',$this->db->esc_like('wb_file_').'%',$this->db->esc_like('wb_quota_').'%',$this->db->esc_like('wb_req_').'%',$batch),ARRAY_A);
  $processed=0;
  foreach($rows as $row){$name=$row['option_name'];if($dry){if(preg_match('/^wb_(file_[a-f0-9]{32}|req_[a-f0-9]{64}|quota_.+)$/D',$name))$processed++;continue;}
   if(preg_match('/^wb_file_([a-f0-9]{32})$/D',$name,$m))$this->importLegacy($m[1],(array)get_option($name));
   elseif(preg_match('/^wb_req_([a-f0-9]{64})$/D',$name,$m)){
    $this->sql($this->db->prepare('INSERT IGNORE INTO '.$this->table('receipts').' (id,expires) VALUES (%s,%d)',$m[1],$this->now()+max(604800,$this->cfg['receipt_ttl'])));
   } elseif(!str_starts_with($name,'wb_quota_'))continue;
   if(delete_option($name))$processed++;
  }
  return $processed;
 }
 public function cleanup($dry=false,$batch=250){
  $batch=max(1,min(1000,(int)$batch));$result=['busy'=>false,'dry_run'=>$dry,'assets'=>0,'refs'=>0,'receipts'=>0,'rates'=>0,'legacy_options'=>0,'errors'=>0];
  if(!$this->lock('cleanup',0)){$result['busy']=true;return $result;}
  try {
   $now=$this->now();$a=$this->table('assets');$r=$this->table('refs');
   $rows=$this->column($this->db->prepare("SELECT a.id FROM $a a WHERE a.hold=0 AND a.expires<%d AND NOT EXISTS (SELECT 1 FROM $r r WHERE r.asset=a.id AND (r.kind IN ('order','pending') OR r.expires>=%d)) ORDER BY a.expires LIMIT %d",$now,$now,$batch));
   foreach($rows as $id){if(!$this->lock('asset:'.$id,0))continue;
    try {
     $row=$this->asset($id);$protected=(int)$this->value($this->db->prepare("SELECT COUNT(*) FROM $r WHERE asset=%s AND (kind IN ('order','pending') OR expires>=%d)",$id,$now));
     if(!$row||$row['hold']||$row['expires']>=$now||$protected)continue;
     if($dry){$result['assets']++;continue;}
     $this->sql($this->db->prepare("UPDATE $a SET state='deleting' WHERE id=%s",$id));
     $path=$this->path($id);
     if((file_exists($path)||is_link($path))&&!unlink($path)){$result['errors']++;continue;}
     // All remaining refs are expired cart leases; the bounded pass below removes them.
     $this->sql($this->db->prepare("DELETE FROM $a WHERE id=%s AND hold=0",$id));$result['assets']++;
    }finally{$this->unlock('asset:'.$id);}
   }
   foreach(['refs','receipts','rates'] as $table){
    $t=$this->table($table);$where=$table==='refs'?"kind='cart' AND expires<$now":"expires<$now";$limit=$batch*10;
    if($dry)$result[$table]=min($limit,(int)$this->value("SELECT COUNT(*) FROM $t WHERE $where"));
    else $result[$table]=$this->sql("DELETE FROM $t WHERE $where LIMIT $limit");
   }
   $result['legacy_options']=$this->migrate($batch,$dry);
   return $result;
  }finally{$this->unlock('cleanup');}
 }

}
function wb_ip_in_network($ip,$network){
 $pieces=explode('/',$network);$a=@inet_pton($ip);$b=@inet_pton($pieces[0]);if(!$a||!$b||strlen($a)!==strlen($b))return false;
 $bits=isset($pieces[1])?filter_var($pieces[1],FILTER_VALIDATE_INT):strlen($a)*8;if($bits===false||$bits<0||$bits>strlen($a)*8)return false;
 $full=intdiv($bits,8);$rest=$bits%8;
 return substr($a,0,$full)===substr($b,0,$full)&&(!$rest||((ord($a[$full])^ord($b[$full]))&(255<<(8-$rest)))===0);
}
function wb_client_ip($server=null,$trusted=null){
 $server=$server??$_SERVER;$trusted=$trusted??(defined('WOODBASE_TRUSTED_PROXIES')?WOODBASE_TRUSTED_PROXIES:[]);
 $trusted=is_array($trusted)?$trusted:array_filter(array_map('trim',explode(',',$trusted)));
 $remote=$server['REMOTE_ADDR']??'';if(!filter_var($remote,FILTER_VALIDATE_IP))return 'unknown';
 $isTrusted=fn($ip)=>count(array_filter($trusted,fn($range)=>wb_ip_in_network($ip,$range)))>0;
 if(!$isTrusted($remote))return $remote;
 $chain=array_map('trim',explode(',',$server['HTTP_X_FORWARDED_FOR']??''));if(count($chain)>20)return $remote;
 foreach($chain as $ip)if(!filter_var($ip,FILTER_VALIDATE_IP))return $remote;
 $chain[]=$remote;foreach(array_reverse($chain) as $ip)if(!$isTrusted($ip))return $ip;
 return $remote;
}
function wb_state(){
 static $state;
 if(!$state){global $wpdb;$config=defined('WOODBASE_STORAGE_LIMITS')?WOODBASE_STORAGE_LIMITS:[];$state=new WB_State($wpdb->prefix.'wb_',WOODBASE_PRIVATE_DIR,null,$config);}
 return $state;
}
