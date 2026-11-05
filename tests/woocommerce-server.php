<?php
// Run only in the local Compose WordPress container; no remote credentials.
if(PHP_SAPI!=='cli')exit(1);
$_SERVER['HTTP_HOST']='localhost:8088';$_SERVER['REQUEST_URI']='/';
require '/var/www/html/wp-load.php';
if(wp_get_environment_type()!=='local')throw new Exception('Local tests only');
function check($condition,$message){if(!$condition)throw new Exception($message);}
check(get_option('woocommerce_coming_soon')==='no','Local guest checkout must not be hidden by Coming Soon mode');
$id=(int)get_option('wb_product_id');
$config=['version'=>1,'productId'=>$id,'options'=>['model'=>'moments','wood'=>'natural','binding'=>'bolts','leather'=>'black','motif'=>'moments','extras'=>[]],'inscription'=>'Тест','artwork'=>['fileId'=>null,'x'=>0,'y'=>0,'scale'=>1,'rotation'=>0,'threshold'=>140,'mode'=>'engrave']];
$snapshot=wb_configuration($config+['price'=>1],$id);check(!isset($snapshot['price']),'Browser price must be discarded');
foreach([
 ['options',array_replace($config['options'],['extras'=>['named'=>'corners']])],
 ['options',array_replace($config['options'],['extras'=>[['corners']]])],
 ['options','invalid'],['artwork','invalid'],
 ['version',2],['productId',$id+1],['inscription',str_repeat('а',46)],['inscription','<script>alert(1)</script>'],['options',['model'=>'moments','wood'=>'fake']],['artwork',['x'=>NAN]],
] as [$field,$value]) {
 $bad=$config;$bad[$field]=$value;$rejected=false;
 try{wb_configuration($bad,$id);}catch(Throwable $e){$rejected=true;}
 check($rejected,'Invalid configuration accepted: '.$field);
}
check(\Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled(),'HPOS must be enabled in local setup');
$orders=wc_get_orders(['limit'=>10,'orderby'=>'date','order'=>'DESC','status'=>['on-hold','pending','processing','completed']]);
$found=false;
foreach($orders as $order)foreach($order->get_items() as $item) {
 $raw=$item->get_meta('_woodbase_configuration');if(!$raw)continue;
 $c=json_decode($raw,true);if(!$c['artwork']['fileId'])continue;
 check($order->get_customer_id()===0,'Expected guest order');
 check($c['inscription']==='ТЕСТ WoodBase','Snapshot inscription missing');
 $path=WOODBASE_PRIVATE_DIR.'/'.$c['artwork']['fileId'].'.png';
 check(is_file($path),'Private production artwork missing');
 check((fileperms($path)&0777)===0600,'Private artwork must have mode 0600');
 check((fileperms(WOODBASE_PRIVATE_DIR)&0777)===0700,'Private directory must have mode 0700');
 $p=wc_get_product($id);$oldName=$p->get_name();$oldPrice=$p->get_regular_price();$total=$order->get_total();
 try {
  $p->set_name('Changed after test order');$p->set_regular_price('9999');$p->save();
  $fresh=wc_get_order($order->get_id());$saved=$fresh->get_item($item->get_id());
  check($saved->get_meta('_woodbase_configuration')===$raw,'Catalog change mutated order snapshot');
  check($fresh->get_total()===$total,'Catalog change mutated order price');
 } finally {$p->set_name($oldName);$p->set_regular_price($oldPrice);$p->save();}
 $found=true;break 2;
}
check($found,'Complete the browser guest-order test before server snapshot verification');
echo "PASS server validation, HPOS, guest order snapshot, private artwork, catalog-change independence\n";
