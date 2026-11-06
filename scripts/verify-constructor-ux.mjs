import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const phase=process.env.WB_UX_PHASE||'after';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
const errors=[];
async function run(name,fn){if(process.env.WB_UX_CASE&&!name.includes(process.env.WB_UX_CASE))return;try{await fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message);}}
async function open(origin,width=1440,motion='reduce'){
 const context=await browser.newContext({viewport:{width,height:width<800?844:1000},reducedMotion:motion});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});await page.waitForSelector('#tab-binding');
 await page.evaluate(()=>document.querySelector('#skip-intro')?.click());
 await page.locator('nav a[href="#constructor"]').click();await page.waitForTimeout(500);
 return page;
}
try{
 await mkdir('docs/constructor-ux-assets',{recursive:true});await mkdir('work/constructor-ux',{recursive:true});
 for(const width of [320,375,390,768,1440])await run('tabs and controls '+width,async()=>{
  const page=await open('http://localhost:5174',width);
  try{
   await page.screenshot({path:`docs/constructor-ux-assets/${phase}-${width}.jpg`,quality:85});
   const hit=await page.locator('[role=tab]').evaluateAll(tabs=>tabs.map(tab=>{const r=tab.getBoundingClientRect();return {id:tab.id,rect:r.toJSON(),covered:!tab.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
   assert.ok(hit.every(t=>!t.covered),'preview covers constructor tabs: '+JSON.stringify(hit));
   for(const id of ['cover','extras','binding']){
    await page.locator('#tab-'+id).click();assert.equal(await page.locator('#panel-'+id).isVisible(),true);
   }
   for(const delta of [250,350]){await page.mouse.wheel(0,delta);await page.waitForTimeout(120);const overlap=await page.locator('[role=tab]').evaluateAll(tabs=>tabs.some(tab=>{const r=tab.getBoundingClientRect();return r.y>120&&r.y<innerHeight&&!tab.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));assert.equal(overlap,false,'tabs covered after scroll');}
   await page.locator('#tab-cover').click();await page.locator('#inscription').fill('Ширина '+width);
   await page.locator('#tab-extras').click();await page.locator('#add-cart').click();
   await page.locator('#open-cart').click();assert.match(await page.locator('#cart-items').innerText(),new RegExp('Ширина '+width));await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }finally{await page.context().close();}
 });
 for(const [mode,origin] of [['demo','http://localhost:5174'],['woocommerce','http://localhost:5173']])await run('draft reload and original safety '+mode,async()=>{
  const page=await open(origin);
  try{
   if(mode==='woocommerce')await page.waitForFunction(()=>document.querySelector('.commerce-mode')?.textContent.startsWith('Тестовый WooCommerce'));
   await page.locator('[data-color="3"]').click();await page.locator('[data-studio-leather="brown"]').click();await page.locator('[data-studio-binding="woven"]').click();
   await page.locator('#tab-cover').click();await page.locator('[data-motif="5"]').click();await page.locator('#inscription').fill('Мой незавершённый альбом');
   const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=120;c.height=80;const x=c.getContext('2d');x.fillRect(12,12,90,50);return c.toDataURL().split(',')[1];});
   const file={name:'ux-artwork.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')};
   await page.locator('#upload').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('#upload-status').textContent.startsWith('Рисунок загружен'));
   for(const [id,value]of [['image-scale','1.25'],['image-x','8'],['image-y','-7'],['image-rotation','15'],['image-threshold','160']])await page.locator('#'+id).fill(value);
   await page.locator('[data-image-mode="original"]').click();
   await page.locator('#tab-extras').click();await page.locator('.extra input[value="box"]').check();
   // A real reload immediately after the last action must not lose the last step.
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#tab-extras');
   assert.equal(await page.locator('#inscription').inputValue(),'Мой незавершённый альбом','draft inscription was lost on reload');
   assert.equal(await page.locator('[data-color="3"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#leather').inputValue(),'brown');assert.equal(await page.locator('#binding').inputValue(),'woven');assert.equal(await page.locator('#model').inputValue(),'5');
   assert.equal(await page.locator('#tab-extras').getAttribute('aria-selected'),'true');
   assert.equal(await page.locator('#image-mode').inputValue(),'original');
   assert.equal(await page.locator('.extra input[value="box"]').isChecked(),true);
   await page.locator('.extra input[value="box"]').uncheck();
   for(const [id,value]of [['image-scale','1.25'],['image-x','8'],['image-y','-7'],['image-rotation','15'],['image-threshold','160']])assert.equal(await page.locator('#'+id).inputValue(),value);
   const stored=await page.evaluate(()=>JSON.stringify({...localStorage}));assert.ok(!stored.includes('data:image'),'private image data must not enter localStorage');assert.ok(!stored.includes('Cart-Token'));
   assert.match(await page.locator('#draft-status').innerText(),/оригинал|исходный/);
   if(mode==='woocommerce')await page.waitForFunction(()=>!document.querySelector('#add-cart').disabled);
   await page.locator('#add-cart').click();assert.equal(await page.locator('#cart-count').innerText(),'0','missing original must not become a different ordered album');
   await page.locator('#tab-cover').click();await page.locator('#upload').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('#upload-status').textContent.startsWith('Рисунок загружен'));
   await page.locator('#tab-extras').click();await page.locator('#add-cart').click();
   await page.waitForFunction(()=>document.querySelector('#cart-count').textContent==='1');await page.locator('#open-cart').click();assert.match(await page.locator('#cart-items').innerText(),/Мой незавершённый альбом/);await page.keyboard.press('Escape');
   assert.ok(!(await page.evaluate(()=>JSON.stringify({...localStorage}))).includes('data:image'),'cart persistence must also exclude customer image content');
   await page.locator('#reset-draft').click();assert.equal(await page.locator('#inscription').inputValue(),'История нашей семьи');assert.equal(await page.locator('#tab-binding').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#cart-count').innerText(),'1','reset must preserve the cart');
   await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.locator('#inscription').inputValue(),'История нашей семьи');
  }finally{await page.context().close();}
 });
 await run('read-only and corrupt storage recovery',async()=>{
  let page=await open('http://localhost:5174');
  try{
   await page.locator('#tab-cover').click();await page.locator('#inscription').fill('Сохранённый проект');
   await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='woodbase-draft-v1')throw new DOMException('quota','QuotaExceededError');return original.call(this,key,value);};});
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#draft-status');
   assert.equal(await page.locator('#inscription').inputValue(),'Сохранённый проект');assert.match(await page.locator('#draft-status').innerText(),/не удалось/);
  }finally{await page.context().close();}
  page=await open('http://localhost:5174');
  try{
   await page.evaluate(()=>localStorage.setItem('woodbase-draft-v1','{broken'));
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#draft-status');
   assert.equal(await page.locator('#inscription').inputValue(),'История нашей семьи');assert.match(await page.locator('#draft-status').innerText(),/повреждён/);
  }finally{await page.context().close();}
 });
 await run('reset cancels pending image decode',async()=>{
  const page=await open('http://localhost:5174');
  try{
   await page.locator('#tab-cover').click();
   await page.evaluate(()=>{const decode=window.createImageBitmap.bind(window);window.createImageBitmap=async(...args)=>{const bitmap=await decode(...args);await new Promise(resolve=>window.finishArtworkDecode=resolve);return bitmap;};});
   await page.locator('#upload').setInputFiles('public/favicon.png');
   await page.waitForFunction(()=>typeof window.finishArtworkDecode==='function');
   await page.locator('#reset-draft').click();await page.evaluate(()=>window.finishArtworkDecode());await page.waitForTimeout(150);
   assert.equal(await page.locator('#upload-thumb').evaluate(e=>e.hidden),true,'late decode must not resurrect an image after reset');
   assert.ok(!(await page.locator('#upload-status').innerText()).includes('Рисунок загружен'));
  }finally{await page.context().close();}
 });
 assert.deepEqual(errors,[],'no uncaught browser errors');
}finally{await writeFile('work/constructor-ux/'+phase+'-results.json',JSON.stringify({results,errors},null,2));await browser.close();}
if(results.some(r=>!r.pass))process.exitCode=1;
