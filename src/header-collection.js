import {createFavorites} from './favorites.js';

export function setupHeaderCollection({models,openProduct,escape,money}) {
 const ids=[3,1,2,4,5];
 let storage; try {storage=localStorage;} catch {}
 const favorites=createFavorites(storage,ids);
 const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 4.6a5.4 5.4 0 0 0-7.6 0L12 5.4l-.8-.8a5.4 5.4 0 0 0-7.6 7.6L12 21l8.4-8.8a5.4 5.4 0 0 0 0-7.6Z"/></svg>';
 const header=document.querySelector('#app>header'),cart=document.querySelector('#open-cart');
 const actions=document.createElement('div');actions.className='header-actions';cart.before(actions);
 actions.innerHTML=`<button class="header-favorites" type="button" aria-label="Открыть избранное">${heart}<span class="favorites-count" hidden></span></button>`;actions.append(cart);
 const nav=header.querySelector('nav');
 nav.insertAdjacentHTML('beforeend','<a href="#cartoons">Мультики</a><a href="#reviews">Отзывы</a><a href="#delivery">Доставка</a>');
 document.querySelector('.hero-invitation-label')?.remove();document.querySelector('.hero-invitation-arrow')?.remove();
 document.querySelector('.hero-invitation')?.setAttribute('aria-label','Давай сохраним их в альбоме? Перейти в конструктор');
 document.querySelectorAll('.green-scroll-hint,.green-scroll-skip').forEach(el=>el.hidden=true);
 document.querySelector('#home-page .closing').insertAdjacentHTML('beforebegin',`
  <section id="cartoons" class="section new-story-section"><span class="eyebrow">МИР ВУДИ</span><h2>Мультики</h2><p>Здесь будут появляться мультфильмы с Вуди. Первый выпуск ещё впереди.</p></section>
  <section id="reviews" class="section new-story-section"><span class="eyebrow">ВАШИ ИСТОРИИ</span><h2>Отзывы</h2><p>Скоро здесь появятся отзывы и фотографии альбомов от наших покупателей.</p></section>
  <section id="delivery" class="section new-story-section"><span class="eyebrow">ИЗ МАСТЕРСКОЙ К ВАМ</span><h2>Доставка</h2><p>Способ, стоимость и сроки доставки согласуем при оформлении заказа. До изготовления мастерская подтвердит комплектацию и итоговую стоимость.</p><a class="text-link" href="#constructor">Собрать свой альбом →</a></section>`);
 const dialog=document.createElement('dialog');dialog.id='favorites-dialog';dialog.setAttribute('aria-labelledby','favorites-title');document.body.append(dialog);
 function button(id,extra='') {return `<button type="button" class="album-favorite ${extra}" data-favorite="${id}" aria-pressed="${favorites.has(id)}" aria-label="${favorites.has(id)?'Убрать из избранного':'В избранное'}: ${escape(models[id].name)}">${heart}</button>`;}
 function renderList() {
  const saved=favorites.list();
  dialog.innerHTML=`<div class="cart-heading"><h2 id="favorites-title">Избранное</h2><button type="button" data-close-favorites aria-label="Закрыть избранное">×</button></div><div class="favorites-list">${saved.length?saved.map(id=>`<article class="favorite-item"><button type="button" data-view-favorite="${id}" class="favorite-preview"><img src="${models[id].photos[0]}" alt="Альбом ${escape(models[id].name)}"><span><strong>${escape(models[id].name)}</strong><small>${money(models[id].price)}</small></span></button>${button(id)}</article>`).join(''):'<p class="empty-favorites">Сохраняйте альбомы, которые вам нравятся, нажимая на сердечко.</p>'}</div>`;
 }
 function sync() {
  document.querySelectorAll('[data-favorite]').forEach(el=>{const id=+el.dataset.favorite;el.setAttribute('aria-pressed',String(favorites.has(id)));el.setAttribute('aria-label',`${favorites.has(id)?'Убрать из избранного':'В избранное'}: ${models[id].name}`);});
  const count=actions.querySelector('.favorites-count');count.textContent=String(favorites.list().length);count.hidden=!favorites.list().length;
  actions.querySelector('.header-favorites').setAttribute('aria-label',`Открыть избранное (${favorites.list().length})`);
 }
 actions.querySelector('.header-favorites').onclick=()=>{renderList();dialog.showModal();};
 document.addEventListener('click',e=>{
  const toggle=e.target.closest('[data-favorite]');
  if(toggle){e.preventDefault();e.stopPropagation();favorites.toggle(+toggle.dataset.favorite);sync();if(dialog.open){renderList();dialog.querySelector(`[data-favorite="${toggle.dataset.favorite}"]`)?.focus();}return;}
  if(e.target.closest('[data-close-favorites]')) dialog.close();
  const view=e.target.closest('[data-view-favorite]');if(view){dialog.close();openProduct(+view.dataset.viewFavorite);}
 });
 const stage=document.querySelector('.cosmic-stage');
 const covers=[...document.querySelectorAll('.cosmic-album:not(.cosmic-phantom)')];
 const overlay=document.createElement('div');overlay.className='collection-favorites';stage.append(overlay);
 overlay.innerHTML=ids.map(id=>button(id,'cover-favorite')).join('');
 const hearts=[...overlay.children];let queued=false;
 function placeHearts(){queued=false;const sr=stage.getBoundingClientRect();covers.forEach((cover,i)=>{const rect=cover.getBoundingClientRect(),el=hearts[i];const visible=cover.getAttribute('aria-hidden')!=='true'&&rect.right>0&&rect.left<innerWidth;el.hidden=!visible;el.style.left=`${rect.right-sr.left-80}px`;el.style.top=`${rect.top-sr.top+28}px`;el.style.zIndex=String(26-i);el.style.opacity=cover.style.opacity;});}
 function schedule(){if(!queued){queued=true;requestAnimationFrame(placeHearts);}}
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});schedule();
 const detail=document.querySelector('#product-detail');
 new MutationObserver(()=>{if(detail.querySelector('[data-favorite]'))return;const title=detail.querySelector('h2');if(!title)return;const id=ids.find(id=>models[id].name===title.textContent);if(id!==undefined){title.insertAdjacentHTML('afterend',button(id,'detail-favorite'));sync();}}).observe(detail,{childList:true});
 sync();
}

