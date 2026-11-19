<?php
if(!defined('ABSPATH'))exit;
// Secrets are process environment values, never options exposed by the storefront.
function wb_tg_config(){
 if(getenv('WOODBASE_TELEGRAM_BOT_ENABLED')!=='1')return null;
 $token=getenv('WOODBASE_TELEGRAM_BOT_TOKEN');$secret=getenv('WOODBASE_TELEGRAM_WEBHOOK_SECRET');$group=getenv('WOODBASE_TELEGRAM_GROUP_ID');
 if(!is_string($token)||!preg_match('/^[0-9]+:[A-Za-z0-9_-]{30,}$/D',$token)||!is_string($secret)||!preg_match('/^[A-Za-z0-9_-]{32,256}$/D',$secret)||!is_string($group)||!preg_match('/^-[0-9]+$/D',$group))return null;
 return ['token'=>$token,'secret'=>$secret,'group'=>$group,'username'=>'WoodBaseLazerBot'];
}
function wb_tg_call($method,$body){
 $config=wb_tg_config();if(!$config)throw new WB_Problem('Бот пока не подключён.',503);
 $response=wp_remote_post('https://api.telegram.org/bot'.$config['token'].'/'.$method,['timeout'=>12,'redirection'=>0,'headers'=>['Content-Type'=>'application/json'],'body'=>wp_json_encode($body)]);
 if(is_wp_error($response))throw new WB_Problem('Telegram временно недоступен.',503);
 $data=json_decode(wp_remote_retrieve_body($response),true);
 if(wp_remote_retrieve_response_code($response)!==200||empty($data['ok']))throw new WB_Problem('Telegram временно недоступен.',503);
 return $data['result'];
}
function wb_tg_send($chat,$text,$extra=[]){
 // Plain text only. Chunk by bytes to stay below Telegram's character limit.
 $ids=[];
 do{$chunk=mb_strcut($text,0,3500,'UTF-8');$text=substr($text,strlen($chunk));$r=wb_tg_call('sendMessage',['chat_id'=>$chat,'text'=>$chunk]+($text===''?$extra:[]));$ids[]=(string)$r['message_id'];}while($text!=='');
 return $ids;
}
function wb_tg_link($order){
 $config=wb_tg_config();if(!$config)return null;
 $token=$order->get_meta('_wb_tg_start');$expires=(int)$order->get_meta('_wb_tg_expires');
 if(!$token||($expires<time()&&!$order->get_meta('_wb_tg_chat'))){
  $token='wb_'.bin2hex(random_bytes(24));$order->update_meta_data('_wb_tg_start',$token);$order->update_meta_data('_wb_tg_start_hash',hash_hmac('sha256',$token,wp_salt('auth')));$order->update_meta_data('_wb_tg_expires',time()+172800);$order->save();
 }
 return 'https://t.me/'.$config['username'].'?start='.$token;
}
function wb_tg_summary($order){
 $data=wb_order_response($order);$parts=['Заказ №'.$data['number']];
 foreach($data['items'] as $i=>$item)$parts[]=($i+1).'. '.$item['name'].' × '.$item['quantity']."\n".implode("\n",$item['details']);
 $parts[]='Стоимость альбомов: '.$data['total'].' '.$data['currency'];$parts[]='Макет, доставка и оплата согласуются с мастерской.';
 return implode("\n\n",$parts);
}
function wb_tg_find($meta,$value){
 $orders=wc_get_orders(['limit'=>1,'type'=>'shop_order','status'=>array_keys(wc_get_order_statuses()),'meta_query'=>[['key'=>$meta,'value'=>$value]],'orderby'=>'ID','order'=>'DESC']);return $orders[0]??null;
}
function wb_tg_permission($request){
 $config=wb_tg_config();$secret=$request->get_header('X-Telegram-Bot-Api-Secret-Token');
 return $config&&is_string($secret)&&hash_equals($config['secret'],$secret)?true:new WP_Error('wb_forbidden','Доступ запрещён.',['status'=>403]);
}
function wb_tg_order_lock($order,$fn){
 $lock='telegram-order:'.$order->get_id();if(!wb_state()->lock($lock,3))throw new WB_Problem('Обработка уже выполняется.',503);
 try{return $fn(wc_get_order($order->get_id()));}finally{wb_state()->unlock($lock);}
}
function wb_tg_start($message,$payload){
 $chat=(string)$message['chat']['id'];
 if(!preg_match('/^wb_[a-f0-9]{48}$/D',$payload)){wb_tg_send($chat,'Соберите альбом на https://woodbase-lazer.ru/ и перейдите в бот из сохранённого заказа. Вопросы мастерской: @WoodBase_Lazer');return;}
 $order=wb_tg_find('_wb_tg_start_hash',hash_hmac('sha256',$payload,wp_salt('auth')));
 if(!$order||$order->get_meta('_wb_checkout_ready')!=='yes'){wb_tg_send($chat,'Ссылка недействительна. Откройте заказ на сайте и перейдите в бот ещё раз.');return;}
 wb_tg_order_lock($order,function($order)use($message,$chat){
  $bound=(string)$order->get_meta('_wb_tg_chat');
  if(($bound!==''&&$bound!==$chat)||(!$bound&&(int)$order->get_meta('_wb_tg_expires')<time())){wb_tg_send($chat,'Ссылка недействительна. Откройте заказ на сайте и перейдите в бот ещё раз.');return;}
  if(!$bound){$order->update_meta_data('_wb_tg_chat',$chat);$order->save();}
  $confirmed=$order->get_meta('_wb_tg_confirmed')==='yes';
  update_option('wb_tg_active_'.hash('sha256',$chat),$confirmed?$order->get_id():0,false);
  wb_tg_send($chat,wb_tg_summary($order)."\n\n".($confirmed?'Заказ уже передан мастерской. Следующие сообщения относятся к заказу №'.$order->get_order_number().'.':'Проверьте состав и подтвердите отправку мастерской.'),$confirmed?[]:['reply_markup'=>['inline_keyboard'=>[[['text'=>'Отправить заказ мастерской','callback_data'=>'wb_ok:'.$order->get_id()]]]]]);
 });
}
function wb_tg_confirm($query){
 if(!preg_match('/^wb_ok:([0-9]+)$/D',$query['data']??'',$m))return;
 $order=wc_get_order((int)$m[1]);$chat=(string)($query['message']['chat']['id']??'');
 if(!preg_match('/^[1-9][0-9]*$/D',$chat)||!$order||$order->get_meta('_wb_checkout_ready')!=='yes'||$chat!==(string)($query['from']['id']??'')||$chat!==(string)$order->get_meta('_wb_tg_chat'))return;
 wb_tg_order_lock($order,function($order)use($query,$chat){
  if($order->get_meta('_wb_tg_confirmed')!=='yes'){
   $name=trim(($query['from']['first_name']??'').' '.($query['from']['last_name']??''));$username=$query['from']['username']??'';
   $contact=preg_match('/^[A-Za-z0-9_]{5,32}$/D',$username)?'@'.$username:'Telegram ID '.$chat;
   $ids=wb_tg_send(wb_tg_config()['group'],"Покупатель подтвердил заказ\n".wb_tg_summary($order)."\n\nПокупатель: ".$name."\nСвязь: ".$contact."\nМожно ответить на это сообщение в группе — бот передаст текст покупателю.");
   foreach($ids as $id)$order->add_meta_data('_wb_tg_group_message',wb_tg_config()['group'].':'.$id);
   $order->update_meta_data('_wb_tg_confirmed','yes');$order->update_meta_data('_wb_contact_channel','telegram');$order->update_meta_data('_wb_contact_value',$contact);$order->update_meta_data('_wb_tg_user_id',$chat);
   if($order->get_status()==='wb-message')$order->set_status('wb-callback');$order->save();$order->add_order_note('Покупатель подтвердил заказ через Telegram-бота.');
  }
  if(!$order->get_meta('_wb_tg_ack')){wb_tg_send($chat,'Заказ №'.$order->get_order_number().' передан мастерской. Здесь можно написать уточнения; они будут относиться к этому заказу.');$order->update_meta_data('_wb_tg_ack','yes');$order->save();}
  // One active order per chat, explicitly selected by /start + confirmation.
  update_option('wb_tg_active_'.hash('sha256',$chat),$order->get_id(),false);
 });
 // Failure to clear the Telegram spinner must not trigger a duplicate notification.
 try{wb_tg_call('answerCallbackQuery',['callback_query_id'=>$query['id'],'text'=>'Заказ передан мастерской']);}catch(Throwable $e){}
}
function wb_tg_message($message){
 $config=wb_tg_config();$chat=(string)($message['chat']['id']??'');$text=$message['text']??'';
 if(!empty($message['from']['is_bot']))return;
 if(!is_string($text)||$text===''){
  if(($message['chat']['type']??'')==='private'&&$chat===(string)($message['from']['id']??''))wb_tg_send($chat,'Пока бот передаёт только текст. Добавьте рисунок через конструктор сайта или свяжитесь с @WoodBase_Lazer.');
  return;
 }
 if(strlen($text)>16384)return;
 if($chat===$config['group']){
  $reply=(string)($message['reply_to_message']['message_id']??'');if(!$reply)return;
  $order=wb_tg_find('_wb_tg_group_message',$config['group'].':'.$reply);if(!$order||!$order->get_meta('_wb_tg_confirmed'))return;
  wb_tg_send((string)$order->get_meta('_wb_tg_chat'),'Мастерская · заказ №'.$order->get_order_number()."\n\n".$text);return;
 }
 if(($message['chat']['type']??'')!=='private'||$chat!==(string)($message['from']['id']??''))return;
 if(preg_match('/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(\S+))?$/D',$text,$m)){wb_tg_start($message,$m[1]??'');return;}
 $order=wc_get_order((int)get_option('wb_tg_active_'.hash('sha256',$chat),0));
 if(!$order||(string)$order->get_meta('_wb_tg_chat')!==$chat||$order->get_meta('_wb_tg_confirmed')!=='yes'){wb_tg_send($chat,'Для отправки заказа перейдите в бот из корзины сайта и подтвердите состав. Вопросы без заказа: @WoodBase_Lazer');return;}
 $ids=wb_tg_send($config['group'],'Сообщение покупателя · заказ №'.$order->get_order_number()."\n\n".$text);
 foreach($ids as $id)$order->add_meta_data('_wb_tg_group_message',wb_tg_config()['group'].':'.$id);$order->save();
}
function wb_tg_update($update){
 if(!is_array($update)||!is_int($update['update_id']??null))throw new WB_Problem('Некорректный запрос.',400);
 $id=(string)$update['update_id'];$key='wb_tg_update_'.$id;$lock='telegram-update:'.$id;
 if(!wb_state()->lock($lock,3))throw new WB_Problem('Обработка уже выполняется.',503);
 try{
  if(get_transient($key))return ['ok'=>true];
  if(isset($update['callback_query']))wb_tg_confirm($update['callback_query']);elseif(isset($update['message']))wb_tg_message($update['message']);
  set_transient($key,1,86400);return ['ok'=>true];
 }finally{wb_state()->unlock($lock);}
}
add_action('rest_api_init',function(){register_rest_route('woodbase/v1','/telegram/webhook',['methods'=>'POST','permission_callback'=>'wb_tg_permission','callback'=>function($request){
 try{if(strlen($request->get_body())>65536)throw new WB_Problem('Слишком большой запрос.',413);return wb_tg_update($request->get_json_params());}catch(Throwable $e){return wb_api_error($e);}
}]);});
