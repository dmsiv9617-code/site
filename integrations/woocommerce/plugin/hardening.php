<?php
if(!defined('ABSPATH'))exit;
require_once __DIR__.'/state.php';
function wb_api_error($e){
 $status=$e instanceof WB_Problem?$e->status:500;
 $message=$e instanceof WB_Problem?$e->getMessage():'Не удалось выполнить действие. Повторите позже.';
 if(!($e instanceof WB_Problem))error_log('WoodBase request failed: '.get_class($e));
 return new WP_Error($status===429?'wb_rate':'wb_error',$message,['status'=>$status,'retry_after'=>$e instanceof WB_Problem?$e->retry:0]);
}
add_filter('cron_schedules',function($s){$s['woodbase_5min']=['interval'=>300,'display'=>'WoodBase maintenance'];return $s;});
add_action('plugins_loaded',function(){
 if(!defined('WOODBASE_PRIVATE_DIR'))return;
 if(get_option('wb_schema_version')!=='3'){
  try{if(!wb_state()->lock('schema',3))throw new WB_Problem('Подготовка сервиса ещё выполняется.',503);
   try{if(get_option('wb_schema_version')!=='3'){wb_state()->install();update_option('wb_schema_version','3',false);update_option('wb_order_link_cursor',0,false);delete_option('wb_order_links_complete');}}finally{wb_state()->unlock('schema');}}catch(Throwable $e){error_log('WoodBase schema setup unavailable');return;}
 }
 if(!wp_next_scheduled('wb_maintenance'))wp_schedule_event(time()+300,'woodbase_5min','wb_maintenance');
},20);
register_deactivation_hook(__DIR__.'/woodbase.php',function(){wp_clear_scheduled_hook('wb_maintenance');});
add_action('wb_maintenance',function(){
 try{$stats=wb_state()->cleanup(false,1000);error_log('WoodBase maintenance '.wp_json_encode($stats));}catch(Throwable $e){error_log('WoodBase maintenance failed');}
});
if(defined('WP_CLI')&&WP_CLI){
 WP_CLI::add_command('woodbase cleanup',function($args,$assoc){
  try{$dry=isset($assoc['dry-run']);$stats=wb_state()->cleanup($dry,(int)($assoc['batch-size']??250));if(!$dry&&!$stats['busy'])$stats['orders_linked']=wb_reconcile_order_links(100);WP_CLI::log(wp_json_encode($stats));}catch(Throwable $e){WP_CLI::error('WoodBase maintenance failed; inspect server health.');}
 });
 WP_CLI::add_command('woodbase status',function(){WP_CLI::log(wp_json_encode(wb_state()->counts()));});
}
function wb_session_ttl(){return max(3600,(int)(defined('WOODBASE_STORAGE_LIMITS')?(WOODBASE_STORAGE_LIMITS['session_ttl']??172800):172800));}
add_filter('wc_session_expiration','wb_session_ttl',100);
add_filter('wc_session_expiring',fn()=>max(1800,wb_session_ttl()-3600),100);
// Legacy Woo versions used the longer names; keep the lease aligned with both.
add_filter('woocommerce_session_expiration','wb_session_ttl',100);
add_filter('woocommerce_session_expiring',fn()=>max(1800,wb_session_ttl()-3600),100);
add_filter('woocommerce_set_cookie_options',function($options,$name){
 $options['samesite']='Lax';if(is_ssl())$options['secure']=true;
 if(str_starts_with($name,'wp_woocommerce_session_'))$options['httponly']=true;
 return $options;
},10,2);
function wb_rate_limit($kind,$scope){
 $defaults=['upload'=>['ip'=>30,'owner'=>10],'session'=>['ip'=>60],'catalog'=>['ip'=>120],'add'=>['ip'=>120,'owner'=>30],'cart'=>['ip'=>120],'checkout'=>['ip'=>30]];
 $default=$scope==='global'?500:($defaults[$kind][$scope]??60);
 $value=defined('WOODBASE_RATE_LIMITS')?(WOODBASE_RATE_LIMITS[$kind][$scope]??$default):$default;
 return max(1,(int)$value);
}
// Global gate bounds new IP/session bucket cardinality; identifiers are HMACs, not raw IPs.
add_filter('rest_pre_dispatch',function($result,$server,$request){
 $route=$request->get_route();$kind=null;
 if(str_starts_with($route,'/woodbase/v1/'))$kind=str_contains($route,'/artwork')?'upload':(str_contains($route,'/session')?'session':'catalog');
 elseif($route==='/wc/store/v1/cart/add-item')$kind='add';
 elseif($route==='/wc/store/v1/checkout')$kind='checkout';
 elseif(str_starts_with($route,'/wc/store/v1/cart'))$kind='cart';
 if(!$kind)return $result;
 try{
  wb_state()->rate('global:'.$kind,wb_rate_limit($kind,'global'),60);
  wb_state()->rate('ip:'.$kind.':'.wb_client_ip(),wb_rate_limit($kind,'ip'),60);
 }catch(Throwable $e){return wb_api_error($e);}
 return $result;
},8,3);
add_filter('rest_post_dispatch',function($response,$server,$request){
 if(str_starts_with($request->get_route(),'/woodbase/v1/')||str_starts_with($request->get_route(),'/wc/store/')){
  $response->header('Cache-Control','no-store, private');
  if($response->get_status()===429){$data=$response->get_data();$response->header('Retry-After',(string)max(1,(int)($data['data']['retry_after']??60)));}
 }
 return $response;
},10,3);
function wb_cart_ref($item){return (string)($item['wb_request']??hash('sha256',wp_json_encode($item['woodbase']??[])));}
add_action('woocommerce_cart_loaded_from_session',function($cart){
 foreach($cart->get_cart() as $item){$id=$item['woodbase']['artwork']['fileId']??null;if(!$id)continue;
  try{wb_state()->cart($id,wb_owner(),wb_cart_ref($item));}catch(Throwable $e){wc_add_notice('Макет позиции недоступен. Загрузите оригинал заново.','error');}
 }
});
add_action('woocommerce_cart_item_removed',function($key,$cart){
 $item=$cart->removed_cart_contents[$key]??[];$id=$item['woodbase']['artwork']['fileId']??null;
 if($id)wb_state()->detach($id,wb_cart_ref($item));
},10,2);
add_action('woocommerce_before_cart_emptied',function(){
 if(!WC()->cart)return;
 foreach(WC()->cart->get_cart() as $item){$id=$item['woodbase']['artwork']['fileId']??null;if($id)wb_state()->detach($id,wb_cart_ref($item));}
});
add_action('woocommerce_checkout_create_order_line_item',function($item,$key,$values){
 $id=$values['woodbase']['artwork']['fileId']??null;
 if($id){$pin=bin2hex(random_bytes(16));wb_state()->protect($id,$pin,'pending');$item->add_meta_data('_woodbase_pin',$pin);}
},5,3);
add_action('woocommerce_new_order_item',function($id,$item,$orderId){
 if(!($item instanceof WC_Order_Item_Product))return;
 $c=json_decode($item->get_meta('_woodbase_configuration'),true);$file=$c['artwork']['fileId']??null;
 if($file)wb_state()->order($file,(int)$orderId,(string)$item->get_meta('_woodbase_pin'));
},10,3);
add_action('woocommerce_order_status_completed',function($id){
 wb_state()->reviewOrder($id,defined('WOODBASE_COMPLETED_RETENTION_DAYS')?(int)WOODBASE_COMPLETED_RETENTION_DAYS:0);
});

// Order-item metadata tables are shared by classic storage and HPOS; load each item through WC CRUD.
function wb_reconcile_order_links($batch=100){
 if(get_option('wb_order_links_complete'))return 0;
 global $wpdb;$cursor=(int)get_option('wb_order_link_cursor',0);
 $ids=$wpdb->get_col($wpdb->prepare("SELECT DISTINCT order_item_id FROM {$wpdb->prefix}woocommerce_order_itemmeta WHERE meta_key=%s AND order_item_id>%d ORDER BY order_item_id LIMIT %d",'_woodbase_configuration',$cursor,$batch));
 $linked=0;
 foreach($ids as $id){
  $item=WC_Order_Factory::get_order_item($id);$c=$item?json_decode($item->get_meta('_woodbase_configuration'),true):[];$file=$c['artwork']['fileId']??null;
  if(is_string($file)&&preg_match('/^[a-f0-9]{32}$/D',$file)&&is_file(wb_state()->path($file))){
   if(!wb_state()->asset($file))wb_state()->importLegacy($file,(array)get_option('wb_file_'.$file,[]));
   wb_state()->protect($file,'order:'.$item->get_order_id(),'order',(int)$item->get_order_id());$linked++;
  }
  update_option('wb_order_link_cursor',(int)$id,false);
 }
 if(count($ids)<$batch)update_option('wb_order_links_complete',true,false);
 return $linked;
}
add_action('woocommerce_init',function(){if(defined('WP_CLI')&&WP_CLI)return;try{wb_reconcile_order_links(100);}catch(Throwable $e){error_log('WoodBase legacy order-link reconciliation pending');}},30);
