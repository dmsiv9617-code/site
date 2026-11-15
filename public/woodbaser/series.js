import {resolveVideo} from './video-source.js';
const publicLink='https://disk.yandex.ru/i/DzCimnlpvVKhjA';
const video=document.querySelector('#episode-video');
const screen=document.querySelector('#screen');
const poster=document.querySelector('#poster-button');
const status=document.querySelector('#player-status');
const buttons=[...document.querySelectorAll('[data-watch]')];
const label=document.querySelector('[data-watch-label]');
const expand=document.querySelector('#expand');
const close=document.querySelector('#close-screen');
const hint=document.querySelector('#screen-hint');
const source=document.querySelector('#source-link');
let loading=false,needsSource=true;
function failure(message){
 status.textContent=message;source.hidden=false;label.textContent='Попробовать ещё раз';needsSource=true;
}
async function watch(){
 if(loading)return;
 if(!needsSource){
  if(video.ended)video.currentTime=0;
  try{await video.play();status.textContent='';}catch{status.textContent='Нажмите ▶ в плеере, чтобы продолжить просмотр.';}
  return;
 }
 loading=true;buttons.forEach(button=>button.disabled=true);label.textContent='Загружаем серию…';status.textContent='';source.hidden=true;screen.setAttribute('aria-busy','true');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
 try{
  const url=await resolveVideo(publicLink,{signal:controller.signal});
  video.src=url;video.hidden=false;poster.hidden=true;needsSource=false;video.load();
  try{await video.play();status.textContent='';}catch(error){
   if(error.name==='NotAllowedError')status.textContent='Серия готова. Нажмите ▶ в плеере.';
   else throw error;
  }
  if(!needsSource){label.textContent='Продолжить просмотр';expand.hidden=false;hint.hidden=true;}
 }catch(error){failure(error.name==='AbortError'?'Загрузка заняла слишком много времени. Проверьте интернет и попробуйте ещё раз.':'Не удалось запустить серию. Попробуйте ещё раз или откройте видео на Диске.');}
 finally{clearTimeout(timer);loading=false;buttons.forEach(button=>button.disabled=false);screen.removeAttribute('aria-busy');}
}
buttons.forEach(button=>button.addEventListener('click',watch));
video.addEventListener('error',()=>{if(video.getAttribute('src'))failure('Видео временно недоступно. Нажмите «Попробовать ещё раз», чтобы подключить его заново.');});
video.addEventListener('ended',()=>{label.textContent='Посмотреть ещё раз';});
function windowExpand(){screen.classList.add('is-expanded');document.body.classList.add('has-expanded');close.hidden=false;close.focus();}
expand.addEventListener('click',async()=>{
 close.hidden=false;
 try{
  if(screen.requestFullscreen)await screen.requestFullscreen();
  else if(video.webkitEnterFullscreen){close.hidden=true;video.webkitEnterFullscreen();}
  else windowExpand();
 }catch{windowExpand();}
});
async function closeExpanded(){
 if(document.fullscreenElement===screen)await document.exitFullscreen();
 screen.classList.remove('is-expanded');document.body.classList.remove('has-expanded');close.hidden=true;expand.focus();
}
close.addEventListener('click',closeExpanded);
document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement!==screen&&!screen.classList.contains('is-expanded')){close.hidden=true;expand.focus();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&screen.classList.contains('is-expanded')){event.preventDefault();void closeExpanded();}});
