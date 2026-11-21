<?php
// Local real WordPress/WooCommerce only; intercept all mail before transport.
if(PHP_SAPI!=='cli')exit(1);
$_SERVER['HTTP_HOST']='localhost:8088';$_SERVER['REQUEST_URI']='/';
require '/var/www/html/wp-load.php';
if(wp_get_environment_type()!=='local')throw new Exception('Local tests only');
function check($yes,$message){if(!$yes)throw new Exception($message);}
$oldEnabled=get_option('wb_order_mail_enabled',false);$oldSettings=get_option('woocommerce_new_order_settings',[]);
$smtpPath=wb_smtp_path();$oldSmtp=is_file($smtpPath)?file_get_contents($smtpPath):null;
$order=null;
try{
 update_option('woocommerce_new_order_settings',['enabled'=>'yes','recipient'=>'workshop@example.test']);
 update_option('wb_order_mail_enabled',false);
 check(wb_with_order_mail(fn()=>true)===false,'notifications opt in');
 update_option('wb_order_mail_enabled',true);
 file_put_contents($smtpPath,wp_json_encode(['login'=>'workshop@yandex.ru','password'=>'local-fake-password-only']));chmod($smtpPath,0600);
 require_once ABSPATH.WPINC.'/PHPMailer/PHPMailer.php';
 $mailer=new PHPMailer\PHPMailer\PHPMailer();
 wb_with_order_mail(function()use($mailer){do_action('phpmailer_init',$mailer);});
 check($mailer->Host==='smtp.yandex.ru'&&$mailer->Port===465&&$mailer->SMTPSecure==='ssl'&&$mailer->SMTPAuth,'fixed authenticated TLS SMTP');
 check($mailer->From==='workshop@yandex.ru'&&$mailer->SMTPDebug===0&&$mailer->Password==='local-fake-password-only','sender matches login; no debug output');
 check((fileperms($smtpPath)&0777)===0600,'credential file private');
 check(!wb_order_mail_allowed(['to'=>'workshop@example.test']),'unrelated mail stays blocked');
 wb_with_order_mail(function($to){
  check(wb_order_mail_allowed(['to'=>[$to]]),'scoped workshop mail allowed');
  foreach([['to'=>'buyer@example.test'],['to'=>[$to,'buyer@example.test']],['to'=>$to,'headers'=>"Bcc: buyer@example.test"],['to'=>$to,'attachments'=>['/tmp/private.png']]] as $atts)check(!wb_order_mail_allowed($atts),'extra recipients/attachments rejected');
 });
 check(!wb_order_mail_allowed(['to'=>'workshop@example.test']),'scope ends after callback');
 try{wb_with_order_mail(function(){throw new Exception('test');});}catch(Exception $e){}
 check(!wb_order_mail_allowed(['to'=>'workshop@example.test']),'scope ends after exception');
 update_option('woocommerce_new_order_settings',['enabled'=>'yes','recipient'=>'workshop@example.test,buyer@example.test']);
 check(wb_with_order_mail(fn()=>true)===false,'one explicit recipient required');
 update_option('woocommerce_new_order_settings',['enabled'=>'yes','recipient'=>'workshop@example.test']);
 $captured=[];
 add_filter('pre_wp_mail',function($pre,$atts)use(&$captured){$captured[]=$atts;check(wb_order_mail_allowed($atts),'real Woo mail fits guard');return true;},999,2);
 check(wb_with_order_mail(fn($to)=>wp_mail($to,'Test','No real transport'))===true,'test mail uses scoped transport');
 $order=new WC_Order();$order->set_status('wb-message');$order->update_meta_data('_wb_checkout_ready','yes');$order->save();
 wb_with_order_mail(function()use($order){WC()->mailer()->get_emails()['WC_Email_New_Order']->trigger($order->get_id(),$order);});
 check(count($captured)===2,'real new order and test message captured without sending');
 echo "PASS workshop notifications: opt-in, one recipient, no copies/attachments, scope cleanup, real Woo email; no external mail\n";
}finally{
 if($order)$order->delete(true);
 if($oldSmtp===null)unlink($smtpPath);else file_put_contents($smtpPath,$oldSmtp);
 update_option('wb_order_mail_enabled',$oldEnabled);update_option('woocommerce_new_order_settings',$oldSettings);
}
