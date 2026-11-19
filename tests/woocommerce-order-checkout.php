<?php
// Local Compose integration only; exercises real WooCommerce + HPOS + private storage.
if(PHP_SAPI!=='cli')exit(1);
$_SERVER['HTTP_HOST']='localhost:8088';$_SERVER['REQUEST_URI']='/';
require '/var/www/html/wp-load.php';
if(wp_get_environment_type()!=='local')throw new Exception('Local tests only');
function check($yes,$message){if(!$yes)throw new Exception($message);}
wb_session();
update_option('wb_order_checkout_enabled',true);update_option('wb_order_privacy_url','http://localhost:8088/privacy/');update_option('wb_order_consent_url','http://localhost:8088/consent/');update_option('wb_messenger_contacts',['telegram'=>'https://t.me/woodbase_test']);
check(wb_order_checkout_config()['version']===1,'feature advertised');
$id=(int)get_option('wb_product_id');$prefix=bin2hex(random_bytes(10));
$base=['version'=>1,'productId'=>$id,'options'=>['model'=>'moments','wood'=>'natural','binding'=>'bolts','leather'=>'black','motif'=>'moments','extras'=>['box','metric','pages','extra-corners']],'inscription'=>'Проверка заказа','artwork'=>['fileId'=>null,'x'=>0,'y'=>0,'scale'=>1,'rotation'=>0,'threshold'=>140,'mode'=>'engrave']];
$file=wb_state()->upload(wb_owner(),function($path){file_put_contents($path,base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfZkAAAAASUVORK5CYII='));return ['width'=>1,'height'=>1];});
$base['artwork']['fileId']=$file['fileId'];
$snapshot=wb_configuration($base+['price'=>1],$id);
WC()->cart->empty_cart();WC()->cart->add_to_cart($id,2,0,[],['woodbase'=>$snapshot,'wb_request'=>$prefix]);
$body=['requestId'=>$prefix.'-callback','method'=>'callback','channel'=>'vk','contact'=>'https://vk.ru/example','consent'=>true,'price'=>1];
foreach([['consent'=>false],['method'=>'bad'],['contact'=>''],['channel'=>'other']] as $bad){$rejected=false;try{wb_create_checkout_order(array_replace($body,$bad));}catch(WB_Problem $e){$rejected=$e->status===400;}check($rejected,'invalid request rejected');}
$stale=WC()->cart->get_cart();
$first=wb_create_checkout_order($body)['order'];check($first['total']==='8850.00','server price plus all additions and quantity');check(WC()->cart->is_empty(),'cart cleared only after save');check(count($first['items'])===1&&$first['items'][0]['quantity']===2,'quantity retained');
$again=wb_create_checkout_order($body)['order'];check($again['number']===$first['number'],'retry returns same order with empty cart');
WC()->cart->set_cart_contents($stale);WC()->cart->calculate_totals();$tabBody=array_replace($body,['requestId'=>$prefix.'-other-tab']);$tabOrder=wb_create_checkout_order($tabBody)['order'];check($tabOrder['number']===$first['number'],'different tab request ID cannot duplicate the same cart');check(wb_find_checkout_order(wb_order_request_id($tabBody))!==null,'second tab can recover the same order');
$order=wb_find_checkout_order(wb_order_request_id($body));check($order->get_status()==='wb-callback','callback status');check($order->get_meta('_wb_contact_value')===$body['contact'],'contact retained');check($order->get_meta('_wb_privacy_consent')['version']===1,'consent recorded');
$asset=wb_state()->asset($file['fileId']);check((int)$asset['hold']===1&&$asset['state']==='order','private artwork protected');
$line=array_values($order->get_items())[0];check(json_decode($line->get_meta('_woodbase_configuration'),true)['artwork']['fileId']===$file['fileId'],'original file retained');
$oldOwner=WC()->session->get_customer_id();(new ReflectionProperty(WC_Session::class,'_customer_id'))->setValue(WC()->session,'another-local-test-owner');check(wb_find_checkout_order(wb_order_request_id($body))===null,'other session cannot recover by request ID');(new ReflectionProperty(WC_Session::class,'_customer_id'))->setValue(WC()->session,$oldOwner);
$base['artwork']['fileId']=null;$snapshot=wb_configuration($base,$id);WC()->cart->add_to_cart($id,1,0,[],['woodbase'=>$snapshot,'wb_request'=>$prefix.'-second']);
$body=array_replace($body,['requestId'=>$prefix.'-message','method'=>'messenger','channel'=>'telegram','contact'=>'']);
$fail=function(){throw new RuntimeException('simulated interruption');};add_action('woocommerce_checkout_create_order_line_item',$fail,30);
$failed=false;try{wb_create_checkout_order($body);}catch(RuntimeException $e){$failed=true;}remove_action('woocommerce_checkout_create_order_line_item',$fail,30);check($failed&&!WC()->cart->is_empty(),'interruption preserves cart');
$draft=wb_find_checkout_order(wb_order_request_id($body));check($draft&&!$draft->get_meta('_wb_checkout_ready'),'recoverable incomplete order');
$second=wb_create_checkout_order($body)['order'];check($second['number']===(string)$draft->get_order_number(),'interrupted save resumes same order');check(wb_find_checkout_order(wb_order_request_id($body))->get_status()==='wb-message','message-awaiting status');check(count($second['items'])===1,'retry does not duplicate lines');
check(wb_order_response($order)['total']===$first['total'],'later cart does not change saved price');
echo "PASS real WooCommerce HPOS: two methods, server prices, quantity, consent, private artwork, duplicate retry, interrupted save and owner isolation\n";
