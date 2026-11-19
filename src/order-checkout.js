const channelNames={telegram:'Telegram',vk:'ВКонтакте',max:'MAX'};
export function orderMessage(order){
 const money=new Intl.NumberFormat('ru-RU',{style:'currency',currency:order.currency}).format(Number(order.total));
 return [`Здравствуйте! Хочу оформить заказ №${order.number}`, ...order.items.map((item,i)=>`${i+1}. ${item.name} × ${item.quantity}\n${item.details.join('\n')}`),`Стоимость альбомов: ${money}`, 'Доставку и окончательный макет согласуем с мастерской.'].join('\n\n');
}
export function messengerLink(channel,text,order){
 try{
  const url=new URL(channel.url);
  if(url.protocol!=='https:'||url.username||url.password)return null;
  const allowed={telegram:['t.me'],vk:['vk.me'],max:['max.ru']};
  if(!allowed[channel.id]?.includes(url.hostname)||url.pathname.length<2)return null;
  if(channel.id==='telegram'&&channel.kind==='bot'){
   if(order===undefined)return url.href;
   const start=new URL(order.telegramStartUrl);
   return start.origin===url.origin&&start.pathname===url.pathname&&/^wb_[a-f0-9]{48}$/.test(start.searchParams.get('start')||'')?start.href:null;
  }
  if(channel.id==='telegram'&&text.length<=3500)url.searchParams.set('text',text);
  return url.href;
 }catch{return null;}
}
export function setupOrderCheckout({button,config,request,onSaved,onReset}){
 if(config?.version!==1)return;
 const dialog=document.createElement('dialog');dialog.className='order-checkout';dialog.id='order-checkout';dialog.setAttribute('aria-labelledby','order-checkout-title');
 dialog.innerHTML=`<form method="dialog" class="order-close"><button aria-label="Закрыть оформление">×</button></form><h2 id="order-checkout-title">Оформить заказ</h2><p class="order-intro">Сохраним комплектацию и согласуем макет, доставку и оплату в переписке.</p><form id="order-checkout-form"><fieldset class="order-methods"><legend>Как вам удобнее?</legend><label><input type="radio" name="method" value="callback" checked><span><strong>Оставить заказ на сайте</strong><small>Мастерская напишет вам</small></span></label><label><input type="radio" name="method" value="messenger"><span><strong>Написать в мессенджер</strong><small>Вы сами отправите описание и номер заказа</small></span></label></fieldset><label class="order-field">Способ связи<select name="channel"></select></label><label class="order-field order-contact">Ваш контакт<input name="contact" maxlength="160" autocomplete="off" placeholder="Имя пользователя, ссылка или телефон"><small>Укажите контакт, по которому мастерская сможет вам написать</small></label><label class="order-consent"><input name="consent" type="checkbox" required><span>Даю согласие на обработку персональных данных для оформления заказа. <a class="order-consent-link" target="_blank" rel="noopener">Согласие</a> · <a class="order-privacy" target="_blank" rel="noopener">Политика конфиденциальности</a></span></label><p class="order-availability"></p><button type="submit" class="button order-submit">Сохранить заказ</button></form><div class="order-receipt" hidden></div><p class="order-result" role="status" aria-live="polite"></p>`;
 document.body.append(dialog);
 // Legal links come from the installed, explicitly enabled server configuration.
 for(const [selector,value] of [['.order-privacy',config.privacyUrl],['.order-consent-link',config.consentUrl]]){
  const url=new URL(value,location.origin);if(!['https:','http:'].includes(url.protocol))throw new Error('Некорректная ссылка документов');dialog.querySelector(selector).href=url.href;
 }
 const form=dialog.querySelector('#order-checkout-form'),select=form.elements.channel,contact=form.elements.contact,submit=form.querySelector('[type=submit]'),result=dialog.querySelector('.order-result'),receipt=dialog.querySelector('.order-receipt');
 const channels=(config.messengers||[]).filter(x=>messengerLink(x,''));
 let busy=false,saved=null,requestId=null;
 const key='woodbase-checkout-request-v1';
 try{requestId=sessionStorage.getItem(key);}catch{}
 function method(){return form.elements.method.value;}
 function update(){
  const selected=select.value,callback=method()==='callback';select.replaceChildren();
  const options=callback?Object.entries(channelNames).map(([id,name])=>({id,name})):channels.map(x=>({id:x.id,name:channelNames[x.id]}));
  for(const x of options)select.add(new Option(x.name,x.id));if(options.some(x=>x.id===selected))select.value=selected;
  form.querySelector('.order-contact').hidden=!callback;contact.required=callback;
  submit.textContent=callback?'Сохранить заказ':'Подготовить заказ для отправки';submit.disabled=busy||!options.length;
  select.disabled=!options.length;
  form.querySelector('.order-availability').textContent=!callback&&!options.length?'Прямые чаты пока не подключены. Оставьте заказ на сайте — мастерская свяжется с вами.':'';
 }
 form.addEventListener('change',()=>{if(!busy)update();});update();
 function showOrder(order){
  saved=order;button.textContent='Ваш сохранённый заказ';button.hidden=false;form.hidden=true;receipt.hidden=false;receipt.replaceChildren();
  const title=document.createElement('h3');title.textContent=`Заказ №${order.number} сохранён`;receipt.append(title);
  const note=document.createElement('p');note.textContent=order.method==='callback'?`Мастерская свяжется с вами через ${channelNames[order.channel]}.`:'Отправьте сообщение мастерской. Открытие чата ещё не означает отправку заказа.';receipt.append(note);
  const text=document.createElement('textarea');text.readOnly=true;text.rows=8;text.value=orderMessage(order);text.setAttribute('aria-label','Описание заказа');receipt.append(text);
  const copy=document.createElement('button');copy.type='button';copy.className='button';copy.textContent='Скопировать заказ';copy.onclick=async()=>{try{await navigator.clipboard.writeText(text.value);result.textContent='Описание и номер заказа скопированы';}catch{text.focus();text.select();result.textContent='Выделили текст — скопируйте его вручную';}};receipt.append(copy);
  const links=document.createElement('div');links.className='order-messenger-links';
  for(const channel of channels){
   const href=messengerLink(channel,text.value,order);if(!href)continue;
   const link=document.createElement('a');link.className='button';link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=`Открыть ${channelNames[channel.id]}`;links.append(link);
  }
  if(channels.length){const hint=document.createElement('p');hint.textContent='Скопируйте описание перед переходом. В Telegram-боте нажмите «Начать» и подтвердите заказ. В прямом чате Telegram короткий заказ будет подготовлен в сообщении. Если текст не появился, вставьте скопированное описание.';receipt.append(hint,links);}
  const next=document.createElement('button');next.type='button';next.className='order-new';next.textContent='Оформить другой заказ';next.onclick=()=>{saved=null;requestId=null;button.textContent='Оформить заказ';onReset?.();try{sessionStorage.removeItem(key);}catch{}receipt.hidden=true;form.hidden=false;form.reset();result.textContent='Добавьте альбомы в корзину для нового заказа';update();dialog.close();};receipt.append(next);
 }
 button.textContent='Оформить заказ';button.removeAttribute('href');button.setAttribute('role','button');button.setAttribute('tabindex','0');
 async function open(){
  if(!dialog.open)dialog.showModal();
  if(saved){showOrder(saved);return;}
  if(requestId&&!busy){busy=true;submit.disabled=true;result.textContent='Проверяем сохранение заказа…';try{const recovered=await request('/orders/recover',{requestId});if(recovered.order)showOrder(recovered.order);result.textContent='';}catch{result.textContent='Не удалось проверить предыдущую попытку. Повторная отправка использует тот же номер запроса.';}finally{busy=false;update();}}
 }
 button.onclick=e=>{e.preventDefault();open();};button.onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();open();}};
 form.onsubmit=async e=>{
  e.preventDefault();if(busy||!form.reportValidity())return;
  if(method()==='callback'&&!contact.value.trim()){contact.setCustomValidity('Укажите контакт для связи');contact.reportValidity();return;}
  requestId ||= crypto.randomUUID();try{sessionStorage.setItem(key,requestId);}catch{}
  const payload={requestId,method:method(),channel:select.value,contact:method()==='callback'?contact.value.trim():'',consent:true};
  busy=true;submit.disabled=true;for(const field of form.elements)field.disabled=true;result.textContent='Сохраняем заказ…';
  try{const data=await request('/orders',payload);showOrder(data.order);result.textContent='';onSaved();}
  catch(error){result.textContent=error.message||'Не удалось сохранить заказ. Попробуйте ещё раз.';}
  finally{busy=false;for(const field of form.elements)field.disabled=false;update();}
 };
 contact.oninput=()=>contact.setCustomValidity('');
 // A successful order remains reachable after a reload even though the cart is empty.
 if(requestId)request('/orders/recover',{requestId}).then(data=>{if(data.order){saved=data.order;button.hidden=false;button.textContent='Ваш сохранённый заказ';}}).catch(()=>{});
 return {hasSavedOrder:()=>!!saved};
}
