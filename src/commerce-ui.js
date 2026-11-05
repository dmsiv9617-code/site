import {configurationFromState, StoreCart} from './commerce.js';
export function setupCommerce({getState,models,refresh,onProduct,getOriginalFile}) {
 const live=import.meta.env.VITE_COMMERCE_MODE==='woocommerce';
 const status=document.querySelector('#cart-status');
 const badge=document.createElement('p');badge.className='control-hint commerce-mode';badge.setAttribute('role','status');
 document.querySelector('#add-cart').before(badge);
 if(!live){badge.textContent='Демо: сохраняется черновик. Заказ не оформляется, оплата недоступна.';return;}
 badge.textContent='Загружаем тестовый товар WooCommerce…';
 const origin=import.meta.env.VITE_WOOCOMMERCE_ORIGIN||location.origin;
 const client=new StoreCart(origin);let product=null,nonce=null,busy=false,uploadedFile=null,fileId=null;
 const add=document.querySelector('#add-cart');add.disabled=true;
 document.querySelector('#mascot-success').hidden=true;
 async function json(path,options={}) {
  const r=await fetch(origin+'/wp-json/woodbase/v1'+path,{credentials:'include',...options,signal:AbortSignal.timeout(15000)});
  const data=await r.json();if(!r.ok)throw new Error(data.message||'Сервис недоступен');return data;
 }
 const fail=e=>{status.textContent='Не удалось выполнить действие: '+e.message;};
 const dialog=document.querySelector('#cart');
 for(const selector of ['#request-form','.telegram-request','#export-order'])dialog.querySelector(selector).hidden=true;
 const note=dialog.querySelector('.checkout-note');note.textContent='Тестовая корзина WooCommerce. Ozon не подключён. Не переводите деньги.';
 const checkout=document.createElement('a');checkout.className='button';checkout.textContent='К тестовому оформлению →';checkout.hidden=true;dialog.append(checkout);
 const cartStatus=document.createElement('p');cartStatus.setAttribute('role','status');dialog.append(cartStatus);
 function textNode(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
 const amount=(minor,prices)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:prices.currency_code}).format(Number(minor)/10**prices.currency_minor_unit);
 function render(data) {
  const container=document.querySelector('#cart-items');container.replaceChildren();
  document.querySelector('#cart-count').textContent=data.items.reduce((n,x)=>n+x.quantity,0);
  for(const item of data.items) {
   const row=document.createElement('div');row.className='cart-item';
   const details=document.createElement('div');details.append(textNode('h3',item.name));
   for(const field of item.item_data||[]) details.append(textNode('p',field.key+': '+field.value));
   const controls=document.createElement('div');controls.append(textNode('strong',amount(item.totals.line_total,item.prices)));
   const quantity=document.createElement('input');quantity.type='number';quantity.min='1';quantity.max='99';quantity.value=item.quantity;quantity.setAttribute('aria-label','Количество '+item.name);
   quantity.onchange=()=>mutate(()=>client.quantity(item.key,Number(quantity.value)));
   const remove=textNode('button','Удалить');remove.onclick=()=>mutate(()=>client.remove(item.key));controls.append(quantity,remove);row.append(details,controls);container.append(row);
  }
  container.append(textNode('p',data.items.length?'Итого: '+amount(data.totals.total_price,data.totals):'В корзине пока нет альбомов.'));
  checkout.hidden=!product||!data.items.length;cartStatus.textContent='';
 }
 async function mutate(fn) {
  if(busy)return;busy=true;checkout.hidden=true;cartStatus.textContent='Обновляем корзину…';
  try{render(await fn());}catch(e){cartStatus.textContent=e.message;}finally{busy=false;}
 }
 document.querySelector('#open-cart').onclick=()=>{if(!dialog.open)dialog.showModal();mutate(()=>client.get());};
 // Existing demo handler is replaced, never mix local drafts into a server cart.
 add.onclick=async()=>{
  if(busy||!product)return;busy=true;add.disabled=true;document.querySelector('#mascot-success').hidden=true;
  status.textContent='Сохраняем альбом…';
  try {
   const state=structuredClone(getState());
   const draft=configurationFromState(state,product.id,state.image?'pending':null);
   for(const [key,value] of Object.entries(draft.options)) {
    const ids=Array.isArray(value)?value:[value];
    if(ids.some(id=>!Object.hasOwn(product.options[key]||{},id)))throw new Error('Выбранная опция недоступна для заказа');
   }
   if(state.image) {
    // Original File identity matters: distinct originals can share the same 600px preview.
    const original=getOriginalFile();
    if(original?.preview!==state.image)throw new Error('После восстановления проекта загрузите исходный рисунок снова. Эскиз 600 px не используется как оригинал.');
    if(original.file!==uploadedFile) {
     const file=original.file;
     const form=new FormData();form.append('file',file,'artwork');
     const saved=await json('/artwork',{method:'POST',headers:{'X-Woodbase-Nonce':nonce},body:form});
     uploadedFile=file;fileId=saved.fileId;
    }
   }
   const config=configurationFromState(state,product.id,state.image?fileId:null);
   render(await client.add(config,crypto.randomUUID()));
   status.textContent='Альбом сохранён в тестовой корзине WooCommerce.';
  } catch(e){fail(e);}finally{busy=false;add.disabled=false;}
 };
 Promise.all([json('/product'),json('/session')]).then(async([p,s])=>{
  if(!p.purchasable||p.currency!=='RUB'||!Number.isFinite(Number(p.price)))throw new Error('Товар недоступен или валюта не поддерживается');
  product=p;nonce=s.nonce;
  // Checkout on backend host uses the same browser cookie session as /wp-json.
  const target=new URL(p.checkoutUrl);if(target.protocol!=='http:'&&target.protocol!=='https:')throw new Error('Некорректный checkout URL');
  checkout.href=target.href;
  models[5].name=p.name;models[5].subtitle=p.description;models[5].price=Number(p.price);
  if(p.images.length)models[5].photos=p.images;
  onProduct(p);refresh();window.dispatchEvent(new CustomEvent('woodbase-product',{detail:p}));
  badge.textContent='Тестовый WooCommerce: доступен только альбом «'+p.name+'». Остальная коллекция — демо.';
  add.disabled=false;render(await client.get());
 }).catch(e=>{product=null;add.disabled=true;badge.textContent='WooCommerce недоступен. Оформление заблокировано; попробуйте обновить страницу.';fail(e);});
}
