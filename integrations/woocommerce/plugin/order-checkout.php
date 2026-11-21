<?php
if(!defined('ABSPATH'))exit;
function wb_default_messenger_contacts(){return ['telegram'=>'https://t.me/WoodBase_Lazer','max'=>'https://max.ru/id525981106353_bot'];}
// SMTP credentials belong in the mail transport configuration, never this API.
function wb_order_mail_recipient(){
 $settings=get_option('woocommerce_new_order_settings',[]);
 $to=trim($settings['recipient']??'');
 return ($settings['enabled']??'yes')==='yes'&&is_email($to)?$to:'';
}
function wb_with_order_mail($callback){
 if(!get_option('wb_order_mail_enabled',false)||!($to=wb_order_mail_recipient()))return false;
 $previous=$GLOBALS['wb_order_mail_scope']??null;
 $GLOBALS['wb_order_mail_scope']=$to;
 try{return $callback($to);}finally{$GLOBALS['wb_order_mail_scope']=$previous;}
}
function wb_order_mail_allowed($atts){
 if(!get_option('wb_order_mail_enabled',false))return false;
 $to=$GLOBALS['wb_order_mail_scope']??null;
 if(!$to||$to!==wb_order_mail_recipient())return false;
 $recipients=$atts['to']??[];if(is_string($recipients))$recipients=explode(',',$recipients);
 if(!is_array($recipients)||count($recipients)!==1||strcasecmp(trim((string)reset($recipients)),$to)!==0)return false;
 $headers=$atts['headers']??'';if(is_array($headers))$headers=implode("\n",$headers);
 return !preg_match('/^(?:cc|bcc):/mi',$headers)&&empty($atts['attachments']);
}
function wb_smtp_path(){return defined('WOODBASE_PRIVATE_DIR')?rtrim(WOODBASE_PRIVATE_DIR,'/').'/smtp-config.json':'';}
function wb_smtp_config(){
 $path=wb_smtp_path();if(!$path||!is_file($path)||is_link($path))return null;
 $config=json_decode(file_get_contents($path),true);
 return is_array($config)&&is_email($config['login']??'')&&!empty($config['password'])?$config:null;
}
add_action('phpmailer_init',function($mailer){
 if(empty($GLOBALS['wb_order_mail_scope']))return;
 $config=wb_smtp_config();
 if(!$config)throw new \PHPMailer\PHPMailer\Exception('WoodBase SMTP is not configured');
 $mailer->isSMTP();$mailer->Host='smtp.yandex.ru';$mailer->Port=465;$mailer->SMTPSecure='ssl';
 $mailer->SMTPAuth=true;$mailer->Username=$config['login'];$mailer->Password=$config['password'];
 $mailer->SMTPDebug=0;$mailer->Timeout=10;$mailer->From=$config['login'];$mailer->FromName='WoodBase';
});
add_action('woocommerce_email_sent',function($sent,$id,$email){
 if($id==='new_order'&&!empty($GLOBALS['wb_order_mail_scope'])&&($email->object??null) instanceof WC_Order){
  $email->object->add_order_note($sent?'Почтовый транспорт принял уведомление мастерской. Доставка во входящие отдельно не подтверждена.':'Уведомление мастерской не отправлено. Проверьте SMTP и список заказов.');
 }
},10,3);
// Enable explicitly only after installation, legal documents and contact checks.
function wb_order_checkout_config(){
 if(!get_option('wb_order_checkout_enabled',false))return null;
 $privacy=get_option('wb_order_privacy_url','');$consent=get_option('wb_order_consent_url','');
 foreach([$privacy,$consent] as $url)if(!is_string($url)||!filter_var($url,FILTER_VALIDATE_URL)||!in_array(parse_url($url,PHP_URL_SCHEME),['https','http'],true))return null;
 $channels=[];
 foreach((array)get_option('wb_messenger_contacts',wb_default_messenger_contacts()) as $id=>$url){
  $hosts=['telegram'=>'t.me','vk'=>'vk.me','max'=>'max.ru'];
  if(!isset($hosts[$id])||!is_string($url)||parse_url($url,PHP_URL_SCHEME)!=='https'||parse_url($url,PHP_URL_HOST)!==$hosts[$id]||parse_url($url,PHP_URL_USER)||parse_url($url,PHP_URL_PASS)||strlen(parse_url($url,PHP_URL_PATH)??'')<2)continue;
  $channels[]=$id==='telegram'&&wb_tg_config()?['id'=>'telegram','kind'=>'bot','url'=>'https://t.me/WoodBaseLazerBot']:['id'=>$id,'url'=>$url];
 }
 return ['version'=>1,'privacyUrl'=>$privacy,'consentUrl'=>$consent,'messengers'=>$channels];
}
function wb_order_request_id($body){
 $id=$body['requestId']??null;
 if(!is_string($id)||!preg_match('/^[a-zA-Z0-9-]{16,80}$/D',$id))throw new WB_Problem('Не удалось подготовить запрос. Обновите страницу.',400);
 return hash_hmac('sha256',wb_owner().':'.$id,wp_salt('auth'));
}
function wb_order_contact($body,$config){
 if(($body['consent']??null)!==true)throw new WB_Problem('Подтвердите согласие на обработку данных.',400);
 $method=$body['method']??null;$channel=$body['channel']??null;$contact=$body['contact']??'';
 if(!in_array($method,['callback','messenger'],true)||!in_array($channel,['telegram','vk','max'],true))throw new WB_Problem('Выберите способ связи.',400);
 if($method==='messenger'&&!in_array($channel,array_column($config['messengers'],'id'),true))throw new WB_Problem('Этот чат пока не подключён. Выберите другой способ связи.',400);
 if(!is_string($contact)||strlen($contact)>640||preg_match('/[\x00-\x1F\x7F<>]/u',$contact))throw new WB_Problem('Проверьте контакт для связи.',400);
 $contact=trim($contact);
 if($method==='callback'&&($contact===''||strlen($contact)<3))throw new WB_Problem('Укажите контакт для связи.',400);
 return ['method'=>$method,'channel'=>$channel,'contact'=>$method==='callback'?$contact:''];
}
function wb_find_checkout_order($key){
 $orders=wc_get_orders(['limit'=>1,'type'=>'shop_order','status'=>array_keys(wc_get_order_statuses()),'meta_query'=>[['key'=>'_wb_checkout_request','value'=>$key]],'orderby'=>'ID','order'=>'DESC']);
 return $orders[0]??null;
}
function wb_order_response($order){
 $items=[];
 foreach($order->get_items() as $item){
  $c=json_decode($item->get_meta('_woodbase_configuration'),true);$details=[];
  $names=['wood'=>'Дерево','binding'=>'Переплёт','leather'=>'Кожа','motif'=>'Рисунок','extras'=>'Дополнения'];
  foreach($names as $key=>$label){$v=$c['labels'][$key]??'';if(is_array($v))$v=implode(', ',$v);if($v!=='')$details[]=$label.': '.$v;}
  $details[]='Надпись: '.($c['inscription']??'');if(!empty($c['artwork']['fileId']))$details[]='Свой рисунок сохранён в заказе';
  $items[]=['name'=>$item->get_name(),'quantity'=>$item->get_quantity(),'details'=>$details];
 }
 $data=['number'=>(string)$order->get_order_number(),'currency'=>$order->get_currency(),'total'=>(string)$order->get_total(),'method'=>$order->get_meta('_wb_contact_method'),'channel'=>$order->get_meta('_wb_contact_channel'),'items'=>$items];
 if(wb_tg_config())$data['telegramStartUrl']=wb_tg_link($order);return $data;
}
function wb_create_checkout_order($body){
 $config=wb_order_checkout_config();if(!$config)throw new WB_Problem('Новое оформление пока недоступно. Обновите страницу.',503);
 $key=wb_order_request_id($body);$contact=wb_order_contact($body,$config);$lock='checkout:'.wb_owner();
 if(!wb_state()->lock($lock,3))throw new WB_Problem('Заказ уже сохраняется. Повторите запрос.',409);
 try{
  $order=wb_find_checkout_order($key);
  if($order&&$order->get_meta('_wb_checkout_ready')==='yes'){
   if(WC()->cart&&WC()->cart->get_cart_hash()===$order->get_meta('_wb_checkout_cart'))WC()->cart->empty_cart();
   return ['order'=>wb_order_response($order)];
  }
  wb_state()->rate('owner:checkout:'.wb_owner(),5,600);
  $cart=WC()->cart;
  if(!$cart||$cart->is_empty())throw new WB_Problem('В корзине пока нет альбомов.',400);
  if(count($cart->get_cart())>30||$cart->get_applied_coupons())throw new WB_Problem('Проверьте состав корзины перед оформлением.',400);
  $snapshots=[];
  foreach($cart->get_cart() as $itemKey=>$item){
   if(empty($item['woodbase'])||!is_int($item['quantity'])||$item['quantity']<1||$item['quantity']>99)throw new WB_Problem('Проверьте состав корзины.',400);
   $snapshots[$itemKey]=wb_configuration($item['woodbase'],(int)$item['product_id']);
   $product=wc_get_product((int)$item['product_id']);if(!$product->has_enough_stock($item['quantity'])||($product->is_sold_individually()&&$item['quantity']>1))throw new WB_Problem('Выбранное количество сейчас недоступно.',409);
  }
  // Recalculate from catalog + server-owned extras, never amounts from the request.
  $cart->calculate_totals();$hash=$cart->get_cart_hash();
  // Different tabs can submit different request IDs for the same cart. The add
  // request IDs are part of the cart hash, so a later intentional reorder differs.
  $cartOwner=hash_hmac('sha256',wb_owner().':'.$hash,wp_salt('auth'));
  if(!$order){
   $matches=wc_get_orders(['limit'=>1,'type'=>'shop_order','status'=>array_keys(wc_get_order_statuses()),'meta_query'=>[['key'=>'_wb_checkout_cart_owner','value'=>$cartOwner]]]);
   $order=$matches[0]??null;
   if($order){$order->add_meta_data('_wb_checkout_request',$key);$order->save();
    if($order->get_meta('_wb_checkout_ready')==='yes'){$cart->empty_cart();return ['order'=>wb_order_response($order)];}
   }
  }
  if($order&&$order->get_meta('_wb_checkout_cart')!==$hash)throw new WB_Problem('Корзина изменилась во время сохранения. Обратитесь в мастерскую.',409);
  if(!$order){
   $order=new WC_Order();$order->set_created_via('woodbase');$order->set_customer_id(0);$order->set_currency(get_woocommerce_currency());$order->set_status('pending');
   $order->update_meta_data('_wb_checkout_request',$key);$order->update_meta_data('_wb_checkout_cart',$hash);$order->update_meta_data('_wb_checkout_cart_owner',$cartOwner);$order->save();
  }
  // Retry an interrupted attempt in the same order. Existing completed orders never enter here.
  foreach($order->get_items() as $id=>$unused)$order->remove_item($id);
  foreach($cart->get_cart() as $itemKey=>$item){
   $item['woodbase']=$snapshots[$itemKey];$line=new WC_Order_Item_Product();$line->set_product($item['data']);$line->set_quantity($item['quantity']);
   $line->set_subtotal($item['line_subtotal']);$line->set_total($item['line_total']);$line->set_taxes($item['line_tax_data']);
   // Reuse the existing private-artwork pinning and snapshot hooks.
   do_action('woocommerce_checkout_create_order_line_item',$line,$itemKey,$item,$order);$order->add_item($line);
  }
  $order->update_meta_data('_wb_contact_method',$contact['method']);$order->update_meta_data('_wb_contact_channel',$contact['channel']);$order->update_meta_data('_wb_contact_value',$contact['contact']);
  $order->update_meta_data('_wb_privacy_consent',['at'=>gmdate('c'),'privacy'=>$config['privacyUrl'],'consent'=>$config['consentUrl'],'version'=>1]);
  $order->update_meta_data('_wb_delivery_pending','yes');$order->calculate_totals(false);
  $order->set_status($contact['method']==='callback'?'wb-callback':'wb-message');$order->update_meta_data('_wb_checkout_ready','yes');$order->save();
  $cart->empty_cart();
  // Notification errors do not turn a saved order into a failed checkout or duplicate it.
  try{wb_with_order_mail(function()use($order){$emails=WC()->mailer()->get_emails();if(isset($emails['WC_Email_New_Order']))$emails['WC_Email_New_Order']->trigger($order->get_id(),$order);});}catch(Throwable $e){$order->add_order_note('Заказ сохранён. Проверьте доставку уведомления мастерской.');}
  return ['order'=>wb_order_response($order)];
 }finally{wb_state()->unlock($lock);}
}
add_action('init',function(){
 foreach(['wb-callback'=>'Нужно связаться с покупателем','wb-message'=>'Ожидает сообщения покупателя'] as $status=>$label)register_post_status('wc-'.$status,['label'=>$label,'public'=>false,'show_in_admin_all_list'=>true,'show_in_admin_status_list'=>true,'label_count'=>_n_noop($label.' <span class="count">(%s)</span>',$label.' <span class="count">(%s)</span>')]);
});
add_filter('wc_order_statuses',function($statuses){$statuses['wc-wb-callback']='Нужно связаться с покупателем';$statuses['wc-wb-message']='Ожидает сообщения покупателя';return $statuses;});
add_action('woocommerce_admin_order_data_after_billing_address',function($order){
 if(!$order->get_meta('_wb_checkout_ready'))return;
 echo '<p><strong>Связь WoodBase:</strong> '.esc_html($order->get_meta('_wb_contact_channel').' · '.$order->get_meta('_wb_contact_value')).'</p><p>Макет, доставка и оплата согласуются с мастерской.</p>';
});
add_action('woocommerce_email_order_meta',function($order,$sent_to_admin,$plain_text){
 if(!$sent_to_admin||!$order->get_meta('_wb_checkout_ready'))return;
 $text='WoodBase: '.$order->get_meta('_wb_contact_method').' · '.$order->get_meta('_wb_contact_channel').' · '.$order->get_meta('_wb_contact_value');
 echo $plain_text?"\n".$text."\n":'<p>'.esc_html($text).'</p>';
},10,3);
add_action('rest_api_init',function(){
 foreach(['/orders','/orders/recover'] as $path)register_rest_route('woodbase/v1',$path,['methods'=>'POST','permission_callback'=>'wb_permission','callback'=>function($request)use($path){
  try{
   $body=$request->get_json_params();if(!is_array($body))throw new WB_Problem('Некорректный запрос.',400);
   if($path==='/orders')return wb_create_checkout_order($body);
   $key=wb_order_request_id($body);$order=wb_find_checkout_order($key);
   return ['order'=>$order&&$order->get_meta('_wb_checkout_ready')==='yes'?wb_order_response($order):null];
  }catch(Throwable $e){return wb_api_error($e);}
 }]);
});
// Protected WooCommerce settings: no credentials or private order data here.
add_action('admin_init',function(){
 register_setting('woodbase_checkout','wb_order_mail_enabled',['type'=>'boolean','sanitize_callback'=>fn($v)=>(bool)$v,'default'=>false]);
 register_setting('woodbase_checkout','wb_order_checkout_enabled',['type'=>'boolean','sanitize_callback'=>fn($v)=>(bool)$v,'default'=>false]);
 foreach(['wb_order_privacy_url','wb_order_consent_url'] as $name)register_setting('woodbase_checkout',$name,['type'=>'string','sanitize_callback'=>fn($v)=>is_string($v)?esc_url_raw(trim($v)):'','default'=>'']);
 register_setting('woodbase_checkout','wb_messenger_contacts',['type'=>'array','sanitize_callback'=>function($v){$out=[];foreach(['telegram','vk','max'] as $id)if(is_string($v[$id]??null)&&trim($v[$id])!=='')$out[$id]=esc_url_raw(trim($v[$id]));return $out;},'default'=>wb_default_messenger_contacts()]);
});
add_filter('option_page_capability_woodbase_checkout',fn()=>'manage_woocommerce');
add_action('admin_menu',function(){
 add_submenu_page('woocommerce','Оформление WoodBase','Оформление WoodBase','manage_woocommerce','woodbase-checkout',function(){
  if(!current_user_can('manage_woocommerce'))return;
  echo '<div class="wrap"><h1>Оформление WoodBase</h1><p>Два способа оформления без регистрации и онлайн-оплаты. Перед включением опубликуйте документы и проверьте прямые чаты.</p><form method="post" action="options.php">';settings_fields('woodbase_checkout');
  echo '<table class="form-table"><tr><th>Новое оформление</th><td><input type="hidden" name="wb_order_checkout_enabled" value="0"><label><input type="checkbox" name="wb_order_checkout_enabled" value="1" '.checked(get_option('wb_order_checkout_enabled'),true,false).'> Включить после проверки</label></td></tr>';
  foreach(['wb_order_privacy_url'=>'Политика обработки персональных данных','wb_order_consent_url'=>'Согласие на обработку данных'] as $name=>$label)echo '<tr><th><label for="'.esc_attr($name).'">'.esc_html($label).'</label></th><td><input class="regular-text" type="url" id="'.esc_attr($name).'" name="'.esc_attr($name).'" value="'.esc_attr(get_option($name,'')).'"></td></tr>';
  $channels=(array)get_option('wb_messenger_contacts',wb_default_messenger_contacts());
  foreach(['telegram'=>'Telegram — https://t.me/...','vk'=>'Сообщения VK — https://vk.me/...','max'=>'MAX — https://max.ru/...'] as $id=>$label)echo '<tr><th><label for="wb-chat-'.esc_attr($id).'">'.esc_html($label).'</label></th><td><input class="regular-text" type="url" id="wb-chat-'.esc_attr($id).'" name="wb_messenger_contacts['.esc_attr($id).']" value="'.esc_attr($channels[$id]??'').'"><p class="description">Только проверенный прямой чат мастерской. Пустое поле скрывает этот канал.</p></td></tr>';
  echo '<tr><th>Уведомления мастерской</th><td><input type="hidden" name="wb_order_mail_enabled" value="0"><label><input type="checkbox" name="wb_order_mail_enabled" value="1" '.checked(get_option('wb_order_mail_enabled'),true,false).'> Отправлять письма о новых заказах</label><p class="description">Сначала настройте SMTP. Получатель — один адрес из письма WooCommerce «Новый заказ». Вложения не отправляются.</p></td></tr></table>';
  if(get_option('wb_order_checkout_enabled')&&!wb_order_checkout_config())echo '<div class="notice notice-error inline"><p>Оформление не включилось: укажите корректные ссылки на оба документа.</p></div>';
  submit_button();echo '</form>';
  $smtp=wb_smtp_config();
  if(isset($_GET['wb_smtp_saved']))echo '<p role="status">'.($_GET['wb_smtp_saved']==='yes'?'Настройки SMTP сохранены. Пароль не отображается.':'Настройки не сохранены. Проверьте адрес Яндекса, пароль приложения и доступность приватного хранилища.').'</p>';
  echo '<h2>Почта Яндекса</h2><p>Сервер smtp.yandex.ru, SSL, порт 465. Используйте отдельный пароль приложения для почты. Обычный пароль от аккаунта не вводите.</p><form method="post" action="'.esc_url(admin_url('admin-post.php')).'"><input type="hidden" name="action" value="wb_save_smtp">';wp_nonce_field('wb_save_smtp');
  echo '<p><label>Адрес отправителя <input type="email" required name="smtp_login" autocomplete="off" value="'.esc_attr($smtp['login']??'').'"></label></p><p><label>Пароль приложения <input type="password" name="smtp_password" autocomplete="new-password" value=""></label></p><p>Пароль хранится в закрытом хранилище сайта. Пустое поле сохраняет прежний пароль для того же адреса.</p>';
  submit_button('Сохранить SMTP','secondary','submit',false);echo '</form><h2>Проверка доставки</h2>';
  if(isset($_GET['wb_mail_test']))echo '<p role="status">'.($_GET['wb_mail_test']==='accepted'?'Почтовый транспорт принял тестовое письмо. Проверьте входящие и спам: это ещё не подтверждение доставки.':'Письмо не отправлено. Проверьте включение уведомлений, одного получателя и SMTP.').'</p>';
  echo '<form method="post" action="'.esc_url(admin_url('admin-post.php')).'"><input type="hidden" name="action" value="wb_test_order_mail">';wp_nonce_field('wb_test_order_mail');submit_button('Отправить тестовое письмо','secondary','submit',false);echo '</form></div>';
 });
});
add_action('admin_post_wb_save_smtp',function(){
 if(!current_user_can('manage_woocommerce'))wp_die('Нет доступа.','',['response'=>403]);
 check_admin_referer('wb_save_smtp');
 $login=trim(wp_unslash($_POST['smtp_login']??''));$password=trim(wp_unslash($_POST['smtp_password']??''));
 $previous=wb_smtp_config();
 if($password===''&&($previous['login']??'')===$login)$password=$previous['password'];
 $ok=false;$path=wb_smtp_path();
 if(is_email($login)&&in_array(strtolower(substr(strrchr($login,'@'),1)),['yandex.ru','ya.ru','yandex.com'],true)&&strlen($password)>=12&&strlen($password)<=256&&!preg_match('/[\r\n]/',$password)&&$path&&is_dir(dirname($path))&&!is_link($path)){
  $tmp=tempnam(dirname($path),'.smtp-');
  if($tmp){
   $data=wp_json_encode(['login'=>$login,'password'=>$password]);
   $ok=chmod($tmp,0600)&&file_put_contents($tmp,$data,LOCK_EX)===strlen($data)&&rename($tmp,$path);
   if(is_file($tmp))unlink($tmp);
  }
 }
 wp_safe_redirect(add_query_arg('wb_smtp_saved',$ok?'yes':'no',admin_url('admin.php?page=woodbase-checkout')));exit;
});
add_action('admin_post_wb_test_order_mail',function(){
 if(!current_user_can('manage_woocommerce'))wp_die('Нет доступа.','',['response'=>403]);
 check_admin_referer('wb_test_order_mail');
 $sent=wb_with_order_mail(fn($to)=>wp_mail($to,'WoodBase: проверка уведомлений','Это тестовое письмо мастерской. Заказ не создавался.'));
 wp_safe_redirect(add_query_arg('wb_mail_test',$sent?'accepted':'failed',admin_url('admin.php?page=woodbase-checkout')));exit;
});
