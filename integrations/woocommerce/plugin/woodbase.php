<?php
/**
 * Plugin Name: WoodBase Album Integration
 * Description: Local prototype: private artwork and validated album snapshots.
 * Version: 0.1.0
 * Requires Plugins: woocommerce
 */
if (!defined('ABSPATH')) exit;
add_action('before_woocommerce_init', function () {
 if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
  \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
 }
});
function wb_options() {
 return ['model'=>['moments'=>'Счастливые моменты'], 'wood'=>['natural'=>'Натуральный','walnut'=>'Ореховый','black'=>'Чёрный','copper'=>'Медный'], 'binding'=>['bolts'=>'Дизайнерские болты','woven'=>'Ручное плетение'], 'leather'=>['black'=>'Чёрная','brown'=>'Коричневая'], 'motif'=>['moments'=>'Счастливые моменты'], 'extras'=>['corners'=>'Уголки','markers'=>'Маркеры','stickers'=>'Наклейки']];
}
function wb_session() {
 if (!function_exists('WC')) throw new Exception('WooCommerce unavailable');
 if (!WC()->cart) wc_load_cart();
 if (method_exists(WC()->session,'set_customer_session_cookie')) WC()->session->set_customer_session_cookie(true);
 if (!WC()->session->get('wb_nonce')) WC()->session->set('wb_nonce', bin2hex(random_bytes(32)));
 return WC()->session;
}
function wb_owner() {return hash_hmac('sha256', wb_session()->get_customer_id(), wp_salt('auth'));}
// WordPress REST CORS may reflect Origin: enforce an explicit allowlist before dispatch.
add_filter('rest_pre_dispatch', function($result, $server, $request) {
 if (preg_match('#^/(woodbase/v1|wc/store/)#', $request->get_route())) {
  $origin = get_http_origin();
  $home = wp_parse_url(home_url());
  $own = $home['scheme'].'://'.$home['host'].(isset($home['port'])?':'.$home['port']:'');
  $allowed = [$own];
  if (defined('WOODBASE_FRONTEND_ORIGIN')) $allowed[] = WOODBASE_FRONTEND_ORIGIN;
  if ($origin && !in_array($origin, $allowed, true)) return new WP_Error('wb_origin', 'Origin denied', ['status'=>403]);
 }
 return $result;
}, 5, 3);
function wb_permission($request) {
 try {$session=wb_session();} catch (Throwable $e) {return new WP_Error('wb_unavailable','WooCommerce unavailable',['status'=>503]);}
 $nonce=$request->get_header('X-Woodbase-Nonce');
 return $nonce && hash_equals($session->get('wb_nonce'),$nonce) ? true : new WP_Error('wb_nonce','Session verification failed',['status'=>403]);
}
function wb_configuration($c, $product_id) {
 if (!is_array($c) || ($c['version']??null)!==1 || ($c['productId']??null)!==$product_id || $product_id!==(int)get_option('wb_product_id')) throw new Exception('Unknown album configuration');
 $o=$c['options']??[]; $labels=[];
 if(!is_array($o))throw new Exception('Invalid options object');
 foreach(wb_options() as $key=>$allowed) {
  if ($key==='extras') {
   if (!isset($o[$key]) || !is_array($o[$key]) || !array_is_list($o[$key]) || count($o[$key])>3) throw new Exception('Invalid extras');
   foreach($o[$key] as $id) if(!is_string($id)||!isset($allowed[$id])) throw new Exception('Unpriced extra');
   if(count(array_unique($o[$key]))!==count($o[$key]))throw new Exception('Duplicate extras');
   $labels[$key]=array_map(fn($id)=>$allowed[$id],$o[$key]);
  } else {
   if (!isset($o[$key]) || !is_string($o[$key]) || !isset($allowed[$o[$key]])) throw new Exception('Invalid '.$key);
   $labels[$key]=$allowed[$o[$key]];
  }
 }
 $text=$c['inscription']??null;
 if (!is_string($text) || mb_strlen($text)>45 || preg_match('/[\x00-\x1F\x7F]/u',$text) || wp_strip_all_tags($text)!==$text) throw new Exception('Invalid inscription');
 $a=$c['artwork']??[];
 if(!is_array($a))throw new Exception('Invalid artwork object');
 foreach (['scale'=>[.5,1.5],'x'=>[-20,20],'y'=>[-20,20],'rotation'=>[-45,45],'threshold'=>[40,220]] as $key=>$range) {
  $n=$a[$key]??null;
  if ((!is_int($n)&&!is_float($n)) || !is_finite((float)$n) || $n<$range[0] || $n>$range[1]) throw new Exception('Invalid placement');
 }
 if (!in_array($a['mode']??'', ['original','engrave'],true)) throw new Exception('Invalid image mode');
 $file=$a['fileId']??null;
 if ($file!==null) {
  if (!is_string($file)||!preg_match('/^[a-f0-9]{32}$/D',$file)) throw new Exception('Invalid artwork');
  $meta=get_option('wb_file_'.$file);
  if (!$meta || !hash_equals($meta['owner'],wb_owner()) || !is_file(WOODBASE_PRIVATE_DIR.'/'.$file.'.png')) throw new Exception('Artwork not owned by session');
 }
 $product=wc_get_product($product_id);
 if (!$product || !$product->is_purchasable() || !$product->is_in_stock()) throw new Exception('Album unavailable');
 // Build a whitelist snapshot: browser price, labels, paths and unknown properties are discarded.
 return ['version'=>1,'productId'=>$product_id,'productName'=>$product->get_name(),'options'=>array_intersect_key($o,wb_options()),'labels'=>$labels,'inscription'=>$text,'artwork'=>['fileId'=>$file,'scale'=>$a['scale'],'x'=>$a['x'],'y'=>$a['y'],'rotation'=>$a['rotation'],'mode'=>$a['mode'],'threshold'=>$a['threshold']]];
}
add_action('rest_api_init', function() {
 register_rest_route('woodbase/v1','/session',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function(){
  try { $s=wb_session();return new WP_REST_Response(['nonce'=>$s->get('wb_nonce')],200,['Cache-Control'=>'no-store, private']); } catch(Throwable $e){return new WP_Error('wb_unavailable','WooCommerce unavailable',['status'=>503]);}
 }]);
 register_rest_route('woodbase/v1','/product',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function(){
  if(!function_exists('wc_get_product'))return new WP_Error('wb_unavailable','WooCommerce unavailable',['status'=>503]);
  $p=wc_get_product((int)get_option('wb_product_id'));
  if(!$p) return new WP_Error('wb_missing','Test album not configured',['status'=>404]);
  return ['id'=>$p->get_id(),'name'=>$p->get_name(),'description'=>wp_strip_all_tags($p->get_description()),'price'=>$p->get_price(),'currency'=>get_woocommerce_currency(),'purchasable'=>$p->is_purchasable() && $p->is_in_stock(),'images'=>array_values(array_filter(array_map('wp_get_attachment_url',array_merge([$p->get_image_id()],$p->get_gallery_image_ids())))),'options'=>wb_options(),'checkoutUrl'=>wc_get_checkout_url()];
 }]);
 register_rest_route('woodbase/v1','/artwork',['methods'=>'POST','permission_callback'=>'wb_permission','callback'=>function($r){
  $files=$r->get_file_params();$f=$files['file']??null;
  if(!$f || $f['error']!==UPLOAD_ERR_OK || $f['size']>5*1024*1024 || !is_uploaded_file($f['tmp_name'])) return new WP_Error('wb_file','PNG, JPEG or WebP up to 5 MiB required',['status'=>400]);
  $info=@getimagesize($f['tmp_name']);$mime=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
  if(!$info || !in_array($mime,['image/png','image/jpeg','image/webp'],true) || ($info['mime']??null)!==$mime || max($info[0],$info[1])>4096 || $info[0]*$info[1]>16000000) return new WP_Error('wb_file','Unsupported image or dimensions',['status'=>400]);
  if(!defined('WOODBASE_PRIVATE_DIR') || !is_dir(WOODBASE_PRIVATE_DIR) || !is_writable(WOODBASE_PRIVATE_DIR)) return new WP_Error('wb_storage','Private storage unavailable',['status'=>503]);
  $reserved=false;
  for($slot=0;$slot<10;$slot++) if(add_option('wb_quota_'.wb_owner().'_'.$slot,'used','',false)) {$reserved=true;break;}
  if(!$reserved)return new WP_Error('wb_quota','Session artwork quota reached',['status'=>429]);
  $editor=wp_get_image_editor($f['tmp_name']);if(is_wp_error($editor))return $editor;
  $id=bin2hex(random_bytes(16));$saved=$editor->save(WOODBASE_PRIVATE_DIR.'/'.$id.'.png','image/png');
  if(is_wp_error($saved))return $saved;
  chmod($saved['path'],0600);
  add_option('wb_file_'.$id,['owner'=>wb_owner(),'created'=>time()], '', false);
  return ['fileId'=>$id,'width'=>$info[0],'height'=>$info[1]];
 }]);
});
add_filter('woocommerce_store_api_add_to_cart_data', function($data,$request) {
 try {
  $extension=$request->get_param('extensions')['woodbase']??null;
  if((int)$data['id']!==(int)get_option('wb_product_id') || !is_array($extension)) throw new Exception('Only the configured personalized test album is supported');
  $snapshot=wb_configuration($extension['configuration']??null,(int)$data['id']);
  $rid=$extension['requestId']??'';
  if(!is_string($rid)||!preg_match('/^[a-zA-Z0-9-]{8,80}$/D',$rid))throw new Exception('Invalid request ID');
  // Atomic unique receipt, scoped to guest session; never blindly retry add-item.
  $receipt='wb_req_'.hash('sha256',wb_owner().':'.$rid);
  if(!add_option($receipt,'received','',false)) throw new Exception('Request already received; refresh cart before retrying');
  $data['cart_item_data']['woodbase']=$snapshot;
  $data['cart_item_data']['wb_request']=$rid;
  return $data;
 } catch(Throwable $e) {
  throw new \Automattic\WooCommerce\StoreApi\Exceptions\RouteException('wb_configuration',$e->getMessage(),409);
 }
},10,2);
add_action('woocommerce_before_calculate_totals',function($cart){
 foreach($cart->get_cart() as $item) if(isset($item['woodbase'])) {
  $product=wc_get_product($item['product_id']);
  if($product) $item['data']->set_price($product->get_price('edit'));
 }
});
add_filter('woocommerce_get_item_data',function($rows,$item){
 if(isset($item['woodbase'])) {
  $c=$item['woodbase'];
  foreach($c['labels'] as $k=>$v) $rows[]=['key'=>$k,'value'=>is_array($v)?implode(', ',$v):$v];
  $rows[]=['key'=>'Гравировка','value'=>$c['inscription']];
 }
 return $rows;
},10,2);
add_action('woocommerce_checkout_create_order_line_item',function($item,$key,$values){
 if(isset($values['woodbase'])) {
  $item->add_meta_data('_woodbase_configuration',wp_json_encode($values['woodbase'],JSON_UNESCAPED_UNICODE));
  $item->add_meta_data('Персонализация',implode(' · ',array_map(fn($v)=>is_array($v)?implode(', ',$v):$v,$values['woodbase']['labels'])));
  $item->add_meta_data('Гравировка',$values['woodbase']['inscription']);
 }
},10,3);
add_action('woocommerce_after_order_itemmeta',function($item_id,$item){
 if(!current_user_can('manage_woocommerce'))return;
 $raw=$item->get_meta('_woodbase_configuration');if(!$raw)return;
 echo '<details><summary>WoodBase: производственный снимок</summary><pre>'.esc_html($raw).'</pre></details>';
 $c=json_decode($raw,true);$file=$c['artwork']['fileId']??null;
 if($file) echo '<a href="'.esc_url(wp_nonce_url(admin_url('admin-post.php?action=wb_artwork&item='.$item_id),'wb_file_'.$item_id)).'">Скачать макет PNG</a>';
},10,2);
add_action('admin_post_wb_artwork',function(){
 if(!current_user_can('manage_woocommerce'))wp_die('Forbidden',403);
 $id=absint($_GET['item']??0);check_admin_referer('wb_file_'.$id);
 $item=WC_Order_Factory::get_order_item($id);
 if(!$item || !$item->get_order_id() || !wc_get_order($item->get_order_id()))wp_die('Not found',404);
 $c=json_decode($item->get_meta('_woodbase_configuration'),true);$file=$c['artwork']['fileId']??'';
 if(!preg_match('/^[a-f0-9]{32}$/D',$file))wp_die('Not found',404);
 $path=WOODBASE_PRIVATE_DIR.'/'.$file.'.png';if(!is_file($path))wp_die('Not found',404);
 nocache_headers();header('Content-Type: image/png');header('X-Content-Type-Options: nosniff');header('Content-Disposition: attachment; filename="WoodBase-'.$id.'.png"');readfile($path);exit;
});
// Keep standard checkout layout; use the established wood palette and readable controls.
add_action('wp_head',function(){if(function_exists('is_checkout')&&is_checkout())echo '<style>:root{--wb-bg:#f3eadc;--wb-ink:#302116;--wb-accent:#835b39}body{background:var(--wb-bg);color:var(--wb-ink);font-family:Manrope,system-ui,sans-serif}.woocommerce button.button.alt{background:var(--wb-accent);border-radius:24px}input,select,textarea{border-radius:8px;padding:10px}</style>';});

// Prevent the classic product form from bypassing required personalization.
add_filter('woocommerce_add_to_cart_validation',function($valid,$id,$quantity,$variation_id=0,$variation=[],$data=[]) {
 if((int)$id===(int)get_option('wb_product_id') && empty($data['woodbase'])) {
  wc_add_notice('Настройте альбом в конструкторе WoodBase.','error');return false;
 }
 return $valid;
},10,6);
// Local prototypes never send checkout emails to real addresses.
add_filter('pre_wp_mail',function($result){return wp_get_environment_type()==='local'?true:$result;});
add_action('admin_post_nopriv_wb_artwork',function(){wp_die('Forbidden','',['response'=>403]);});
