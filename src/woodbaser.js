import './woodbaser.css';
import {resolveVideo} from './woodbaser-source.js';
const poster='/woodbaser/episode-02-cover.webp';
const playIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/></svg>';
const closeIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
// Keep the opening episode featured; add subsequent episodes to the collection below.
const episodes=[
 {id:'01',title:'Знакомьтесь, Вуди',description:'Первая встреча с Вуди в берёзовом лесу',publicLink:'https://disk.yandex.ru/i/MRr1CdmhFyZpFg',poster},
 {id:'02',title:'Знакомство с Пандой',description:'Лесная тропинка, неожиданная встреча и начало новой истории',publicLink:'https://disk.yandex.ru/i/DzCimnlpvVKhjA',poster:'/woodbaser/meet-woody-cover.webp'},
 {"id": "03", "title": "Панда и мёд", "description": "Лесное угощение с неожиданными последствиями", "publicLink": "https://disk.yandex.ru/d/rWsrOMMdmLKkCg", "publicPath": "/Панда и мед.mp4", "poster": "/woodbaser/episode-03-cover.webp"},
 {"id": "04", "title": "Ещё пять минут", "description": "Вуди, телефон и ночь, которая пролетела незаметно", "publicLink": "https://disk.yandex.ru/d/rWsrOMMdmLKkCg", "publicPath": "/VID_20260928_220858_307.mp4", "poster": "/woodbaser/episode-04-cover.webp"},
 {"id": "05", "title": "Три часа ночи", "description": "Когда кот уже проснулся, а Вуди ещё нет", "publicLink": "https://disk.yandex.ru/d/rWsrOMMdmLKkCg", "publicPath": "/VID_20261116_151904_157.mp4", "poster": "/woodbaser/episode-05-cover.webp"},
 {"id": "06", "title": "Только сел…", "description": "Тихий вечер, любимое кресло и очень настойчивый кот", "publicLink": "https://disk.yandex.ru/d/rWsrOMMdmLKkCg", "publicPath": "/VID_20261116_151857_946.mp4", "poster": "/woodbaser/episode-06-cover.webp"},
 {"id": "07", "title": "Альбом раздора", "description": "Один альбом, два друга и ни одного желающего уступить", "publicLink": "https://disk.yandex.ru/d/rWsrOMMdmLKkCg", "publicPath": "/VID_20261115_015446_545.mp4", "poster": "/woodbaser/episode-07-cover.webp"}
];
const featured=episodes[0];
const previous=episodes.slice(1);
const cover=(episode,className)=>`<button type="button" class="${className}" data-watch-woodbaser data-woodbaser-episode="${episode.id}" aria-label="Смотреть: ${episode.title}"><img src="${episode.poster}" alt="Обложка мультфильма «${episode.title}»" width="900" height="1600" loading="lazy" decoding="async"><span class="woodbaser-play" aria-hidden="true">${playIcon}</span></button>`;
export const woodbaserSection=`<section id="cartoons" class="section woodbaser-section" aria-labelledby="woodbaser-title">
 <article class="woodbaser-premiere" aria-labelledby="woodbaser-featured-title">
  <div class="woodbaser-story">
   <div class="woodbaser-intro"><h2 id="woodbaser-title">Вудбейзер</h2><p class="woodbaser-lead">У каждого дня <br>свой сюжет</p><p class="woodbaser-description">Короткие истории про Вуди, его друзей и ситуации, в которых легко узнать себя</p></div>
   <div class="woodbaser-feature-copy"><div class="woodbaser-folio" aria-label="История ${featured.id}"><small>История</small><span>${featured.id}</span><i aria-hidden="true"></i></div><h3 id="woodbaser-featured-title">${featured.title}</h3><p>${featured.description}</p><button type="button" class="woodbaser-watch" data-watch-woodbaser data-woodbaser-episode="${featured.id}"><span aria-hidden="true">${playIcon}</span>Смотреть серию</button></div>
  </div>
  <div class="woodbaser-feature-cover">${cover(featured,'woodbaser-cover')}</div>
 </article>
 ${previous.length?`<div class="woodbaser-archive"><div class="woodbaser-archive-heading"><h3>Другие истории</h3></div><div class="woodbaser-episodes">${previous.map(episode=>`<article>${cover(episode,'woodbaser-cover woodbaser-small-cover')}<div class="woodbaser-small-caption"><span class="woodbaser-small-number" aria-label="История ${episode.id}">${episode.id}</span><h4>${episode.title}</h4></div></article>`).join('')}</div></div>`:''}
</section>`;
export function setupWoodbaser(){
 const section=document.querySelector('#cartoons');
 const dialog=document.createElement('dialog');dialog.id='woodbaser-player';dialog.setAttribute('aria-labelledby','woodbaser-player-title');
 dialog.innerHTML=`<div class="woodbaser-player-heading"><span id="woodbaser-player-title">Вудбейзер</span></div><div class="woodbaser-screen"><video class="woodbaser-video" controls playsinline preload="none" poster="${poster}" aria-label="Вудбейзер"></video><button type="button" class="woodbaser-close" aria-label="Закрыть видео" autofocus>${closeIcon}</button></div><div class="woodbaser-player-actions"><button type="button" class="woodbaser-expand" hidden>На весь экран ⛶</button><button type="button" class="woodbaser-retry" hidden>Попробовать ещё раз</button></div><p class="woodbaser-status" role="status" aria-live="polite"></p><a class="woodbaser-source" href="${featured.publicLink}" target="_blank" rel="noopener noreferrer" hidden>Открыть видео на Диске ↗</a>`;
 document.body.append(dialog);
 const video=dialog.querySelector('video'),screen=dialog.querySelector('.woodbaser-screen'),close=dialog.querySelector('.woodbaser-close'),expand=dialog.querySelector('.woodbaser-expand'),retry=dialog.querySelector('.woodbaser-retry'),status=dialog.querySelector('.woodbaser-status'),source=dialog.querySelector('.woodbaser-source');
 let controller,revision=0,opener,priorOverflow,activeEpisode=featured;
 function fail(message){status.textContent=message;retry.hidden=false;source.hidden=false;expand.hidden=true;}
 async function load(){
  controller?.abort();controller=new AbortController();const current=++revision;const timer=setTimeout(()=>controller.abort(),20000);
  retry.hidden=true;source.hidden=true;expand.hidden=true;status.textContent='Загружаем серию…';screen.setAttribute('aria-busy','true');
  try{
   if(current!==revision||!dialog.open)return;
   const url=await resolveVideo(activeEpisode.publicLink,{path:activeEpisode.publicPath,signal:controller.signal});
   if(current!==revision||!dialog.open)return;
   video.src=url;video.load();
   try{await video.play();}catch(error){if(error.name!=='NotAllowedError')throw error;}
   if(current!==revision||!dialog.open){video.pause();return;}
   status.textContent=video.paused?'Нажмите ▶ в плеере, чтобы начать просмотр.':'';expand.hidden=false;
  }catch(error){if(current===revision&&dialog.open)fail(error.name==='AbortError'?'Загрузка заняла слишком много времени. Попробуйте ещё раз.':'Не удалось запустить серию. Попробуйте ещё раз или откройте видео на Диске.');}
  finally{clearTimeout(timer);if(current===revision)screen.removeAttribute('aria-busy');}
 }
 section.querySelectorAll('[data-watch-woodbaser]').forEach(button=>button.addEventListener('click',()=>{
  activeEpisode=episodes.find(episode=>episode.id===button.dataset.woodbaserEpisode)??featured;
  dialog.querySelector('#woodbaser-player-title').textContent=activeEpisode.title;video.setAttribute('aria-label',activeEpisode.title);video.poster=activeEpisode.poster;source.href=activeEpisode.publicLink;
  opener=button;priorOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();close.focus();void load();
 }));
 function cleanup(){
  ++revision;controller?.abort();video.pause();video.removeAttribute('src');video.load();screen.removeAttribute('aria-busy');dialog.classList.remove('is-expanded');document.body.style.overflow=priorOverflow??'';
  if(document.fullscreenElement===screen)void document.exitFullscreen();opener?.focus({preventScroll:true});
 }
 close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',cleanup);
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 retry.addEventListener('click',()=>void load());
 video.addEventListener('error',()=>{if(dialog.open&&video.getAttribute('src'))fail('Видео временно недоступно. Попробуйте подключить серию заново.');});
 expand.addEventListener('click',async()=>{
  try{if(screen.requestFullscreen)await screen.requestFullscreen();else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();else throw new Error('unsupported');}
  catch{if(dialog.open){dialog.classList.add('is-expanded');close.focus();}}
 });
 dialog.addEventListener('cancel',event=>{if(dialog.classList.contains('is-expanded')){event.preventDefault();dialog.classList.remove('is-expanded');expand.focus();}});
 if(location.hash==='#cartoons')requestAnimationFrame(()=>requestAnimationFrame(()=>section.scrollIntoView({block:'start',behavior:'instant'})));
}

