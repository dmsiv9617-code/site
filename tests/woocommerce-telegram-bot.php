<?php
// Local-only real WooCommerce. Telegram transport is mocked: no real messages.
require '/tmp/woodbase-order-checkout-test.php';
putenv('WOODBASE_TELEGRAM_BOT_ENABLED=1');putenv('WOODBASE_TELEGRAM_BOT_TOKEN=123456:'.str_repeat('x',32));putenv('WOODBASE_TELEGRAM_WEBHOOK_SECRET='.str_repeat('s',64));putenv('WOODBASE_TELEGRAM_GROUP_ID=-1001234567890');
check(wb_tg_config()['username']==='WoodBaseLazerBot','owner-supplied bot');
$public=wp_json_encode(wb_order_checkout_config());check(!str_contains($public,str_repeat('x',32))&&!str_contains($public,str_repeat('s',64)),'secrets never enter public checkout config');
$calls=[];$counter=100;
add_filter('pre_http_request',function($pre,$args,$url)use(&$calls,&$counter){
 if(!str_starts_with($url,'https://api.telegram.org/bot'))return $pre;
 $body=json_decode($args['body'],true);$method=basename(parse_url($url,PHP_URL_PATH));$result=$method==='sendMessage'?['message_id'=>++$counter]:true;
 $calls[]=['method'=>$method,'body'=>$body,'result'=>$result];
 return ['headers'=>[],'response'=>['code'=>200,'message'=>'OK'],'body'=>wp_json_encode(['ok'=>true,'result'=>$result]),'cookies'=>[]];
},10,3);
$order=wb_find_checkout_order(wb_order_request_id($body));
$link=wb_tg_link($order);parse_str(parse_url($link,PHP_URL_QUERY),$query);$token=$query['start'];
check((bool)preg_match('/^wb_[a-f0-9]{48}$/D',$token),'opaque start payload');check(wb_tg_link($order)===$link,'retry preserves start link');
check(wb_order_response($order)['telegramStartUrl']===$link,'server response has the protected link');
$request=new WP_REST_Request('POST','/woodbase/v1/telegram/webhook');check(is_wp_error(wb_tg_permission($request)),'unsigned webhook rejected');$request->set_header('X-Telegram-Bot-Api-Secret-Token',str_repeat('s',64));check(wb_tg_permission($request)===true,'secret checked');
$u=random_int(100000,999999999);$private=['chat'=>['id'=>1234567,'type'=>'private'],'from'=>['id'=>1234567,'first_name'=>'Local','username'=>'local_test_user']];
wb_tg_update(['update_id'=>$u,'message'=>$private+['text'=>'/start '.$token]]);
check((string)wc_get_order($order->get_id())->get_meta('_wb_tg_chat')==='1234567','chat bound after start');
$groupCalls=function()use(&$calls){return array_values(array_filter($calls,fn($c)=>($c['body']['chat_id']??'')==='-1001234567890'));};
check(count($groupCalls())===0,'start alone cannot send the order to staff');
$before=count($calls);wb_tg_update(['update_id'=>$u,'message'=>$private+['text'=>'/start '.$token]]);check(count($calls)===$before,'duplicate update ignored');
$other=['chat'=>['id'=>7654321,'type'=>'private'],'from'=>['id'=>7654321]];
wb_tg_update(['update_id'=>++$u,'message'=>$other+['text'=>'/start '.$token]]);check(!str_contains(end($calls)['body']['text'],'Заказ №'),'another chat cannot read the bound order');
$callback=['id'=>'local-callback','data'=>'wb_ok:'.$order->get_id(),'from'=>$private['from'],'message'=>['chat'=>$private['chat']]];
$forged=$callback;$forged['from']=$other['from'];$forged['message']['chat']=$other['chat'];wb_tg_update(['update_id'=>++$u,'callback_query'=>$forged]);check(count($groupCalls())===0,'another chat cannot confirm the order');
wb_tg_update(['update_id'=>++$u,'callback_query'=>$callback]);check(count($groupCalls())===1,'explicit confirmation notifies staff once');
$fresh=wc_get_order($order->get_id());check($fresh->get_meta('_wb_tg_confirmed')==='yes','confirmation retained');check($fresh->get_status()==='wb-callback','status no longer awaits a customer message');
wb_tg_update(['update_id'=>++$u,'callback_query'=>$callback]);check(count($groupCalls())===1,'repeat button cannot duplicate staff notification');
$groupMessage=$groupCalls()[0]['result']['message_id'];$before=count($calls);
wb_tg_update(['update_id'=>++$u,'message'=>['chat'=>['id'=>-1001234567890,'type'=>'supergroup'],'from'=>['id'=>99],'reply_to_message'=>['message_id'=>$groupMessage],'text'=>'Уточняем макет']]);
check(end($calls)['body']['chat_id']==='1234567'&&str_contains(end($calls)['body']['text'],'Уточняем макет'),'staff reply reaches the bound customer');
wb_tg_update(['update_id'=>++$u,'message'=>$private+['text'=>'Спасибо!']]);check(count($groupCalls())===2,'customer text reaches the closed group');
$before=count($calls);wb_tg_update(['update_id'=>++$u,'message'=>['chat'=>['id'=>-999,'type'=>'supergroup'],'from'=>['id'=>99],'reply_to_message'=>['message_id'=>$groupMessage],'text'=>'forged']]);check(count($calls)===$before,'other groups cannot reply to customers');
// An unclaimed expired link must not expose the order or bind a chat.
$expired=new WC_Order();$expired->set_status('wb-message');$expired->update_meta_data('_wb_checkout_ready','yes');$expired->save();$expiredLink=wb_tg_link($expired);parse_str(parse_url($expiredLink,PHP_URL_QUERY),$q);$expired->update_meta_data('_wb_tg_expires',time()-1);$expired->save();
wb_tg_update(['update_id'=>++$u,'message'=>$other+['text'=>'/start '.$q['start']]]);check(!wc_get_order($expired->get_id())->get_meta('_wb_tg_chat'),'expired token cannot bind');
putenv('WOODBASE_TELEGRAM_BOT_ENABLED=0');check(wb_tg_config()===null,'disabled bot cannot activate checkout');
echo "PASS Telegram bot: secret, opaque link, expiry, explicit confirmation, replay, chat isolation and bidirectional text with mocked Telegram transport\n";
