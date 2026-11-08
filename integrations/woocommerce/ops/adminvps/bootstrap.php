<?php
if (PHP_SAPI !== 'cli') exit(1);
define('WP_INSTALLING',!is_file('/var/www/html/.woodbase-staging-installed'));
$_SERVER['HTTP_HOST']='localhost:8443';
$_SERVER['HTTPS']='on';
$_SERVER['REQUEST_URI']='/';
require '/var/www/html/wp-load.php';
if(wp_get_environment_type()!=='staging'||WP_HOME!=='https://localhost:8443')throw new Exception('Only isolated tunnel staging is allowed');
if(is_blog_installed()&&!is_file('/var/www/html/.woodbase-staging-installed'))throw new Exception('Refusing to seed an existing unmarked database');
require_once ABSPATH.'wp-admin/includes/upgrade.php';
require_once ABSPATH.'wp-admin/includes/plugin.php';
if(!is_blog_installed()) {
 $password=getenv('WB_ADMIN_PASSWORD') ?: trim(stream_get_contents(STDIN));if(!$password)throw new Exception('Missing staging admin password');
 wp_install('WoodBase Staging', 'woodbase-admin', 'local@example.test',true,'',$password);
}
file_put_contents('/var/www/html/.woodbase-staging-installed','staging');
update_option('home','https://localhost:8443');update_option('siteurl','https://localhost:8443');
update_option('blog_public',0);update_option('permalink_structure','/%postname%/');
$result=activate_plugin('woocommerce/woocommerce.php');if(is_wp_error($result))throw new Exception($result->get_error_message());
// Reload after activation in a separate invocation before seeding Woo classes.
if(WP_INSTALLING || !class_exists('WC_Product_Simple')) {echo "WooCommerce activated; rerun bootstrap to seed.\n";exit;}
$result=activate_plugin('woodbase/woodbase.php');if(is_wp_error($result))throw new Exception($result->get_error_message());
update_option('woocommerce_currency','RUB');update_option('woocommerce_default_country','RU');
// A new WooCommerce install enables Coming Soon, which hides guest checkout.
update_option('woocommerce_coming_soon','no');
update_option('woocommerce_enable_guest_checkout','yes');update_option('woocommerce_enable_signup_and_login_from_checkout','no');
update_option('woocommerce_calc_taxes','no');update_option('woocommerce_store_address','Изолированная staging-среда');
update_option('woocommerce_custom_orders_table_enabled','yes');
$p=wc_get_product((int)get_option('wb_product_id'));
if(!$p) {
 $p=new WC_Product_Simple();$p->set_name('Счастливые моменты');$p->set_sku('woodbase-moments-test');
 $p->set_description('ТЕСТОВЫЙ товар WoodBase. Цена и комплектация требуют подтверждения перед коммерческим запуском.');
 $p->set_regular_price('3540');$p->set_status('publish');$p->set_virtual(true);$p->save();update_option('wb_product_id',$p->get_id());
}
if(!$p->get_image_id()) {
 require_once ABSPATH.'wp-admin/includes/image.php';
 $upload=wp_upload_bits('woodbase-moments.webp',null,file_get_contents('/opt/woodbase-moments.webp'));
 if(!$upload['error']) {
  $attachment=wp_insert_attachment(['post_mime_type'=>'image/webp','post_title'=>'WoodBase test album','post_status'=>'inherit'],$upload['file']);
  wp_update_attachment_metadata($attachment,wp_generate_attachment_metadata($attachment,$upload['file']));
  $p->set_image_id($attachment);$p->save();
 }
}
foreach(['checkout'=>['Оформление тестового заказа','[woocommerce_checkout]'],'cart'=>['Корзина','[woocommerce_cart]'],'myaccount'=>['Личный кабинет','[woocommerce_my_account]']] as $slug=>$page) {
 $key='woocommerce_'.$slug.'_page_id';
 if($slug==='checkout') {
  $existing=get_post((int)get_option($key));
  if($existing && has_block('woocommerce/checkout',$existing->post_content)) {
   if(!get_option('wb_blocks_page_id')) update_option('wb_blocks_page_id',wp_insert_post(['post_type'=>'page','post_status'=>'publish','post_name'=>'checkout-blocks','post_title'=>'Тест Checkout Blocks','post_content'=>$existing->post_content]));
   wp_update_post(['ID'=>$existing->ID,'post_content'=>'[woocommerce_checkout]']);
  }
 }

 if(!get_post((int)get_option($key))) update_option($key,wp_insert_post(['post_type'=>'page','post_status'=>'publish','post_name'=>$slug,'post_title'=>$page[0],'post_content'=>$page[1]]));
}
// Staging manual payment only: no provider APIs, messages or shipments.
update_option('woocommerce_bacs_settings',['enabled'=>'yes','title'=>'Тестовый заказ — не оплачивать','description'=>'Изолированный прототип. Деньги не переводить.','instructions'=>'ТЕСТ: не оплачивать.']);
update_option('woocommerce_cod_settings',['enabled'=>'no']);update_option('woocommerce_cheque_settings',['enabled'=>'no']);
flush_rewrite_rules();
echo 'WoodBase test product: '.$p->get_id()."; guest checkout configured.\n";
