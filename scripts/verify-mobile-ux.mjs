import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
const origin=process.env.WB_MOBILE_ORIGIN||'http://localhost:5174';
assert.equal(new URL(origin).hostname,'localhost','Mobile checks use local builds only');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
let failures=0;
await mkdir('work/mobile-fixes',{recursive:true});
async function check(name,fn){try{await fn();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}}
for(const width of [320,390,430]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForSelector('#tab-binding');await page.evaluate(()=>document.querySelector('#skip-intro')?.click());
 await check('catalog entry '+width,async()=>{
  await page.locator('a[href="#catalog"]').first().evaluate(e=>e.click());await page.waitForTimeout(1200);
  assert.ok(await page.locator('.cosmic-stage').evaluate(e=>Number(getComputedStyle(e).opacity)>.95),'catalog is invisible after anchor navigation');
  const album=page.locator('.cosmic-album[tabindex="0"]');await album.click({timeout:3000});assert.ok(await page.locator('#product-detail').evaluate(e=>e.open),'first album should open without extra scrolling');await page.keyboard.press('Escape');
 });
 await check('mobile menu '+width,async()=>{
  const menu=page.getByRole('button',{name:'Открыть меню',exact:true});await menu.click({timeout:1500});
  for(const link of await page.locator('header nav a').all()){const r=await link.boundingBox();assert.ok(r&&r.x>=0&&r.x+r.width<=width&&r.height>=44,'every menu link must be fully visible and touch-sized');}
  await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');
  await menu.click();await page.getByRole('link',{name:'Дизайн',exact:true}).click();assert.equal(await menu.getAttribute('aria-expanded'),'false');
 });
 await check('wizard step starts and preview '+width,async()=>{
  await page.locator('a[href="#constructor"]').first().evaluate(e=>e.click());await page.waitForTimeout(300);
  await page.locator('#step-next').click();
  for(const id of ['cover','extras','binding']){
   await page.locator('#tab-'+id).click();await page.waitForTimeout(150);
   const rect=await page.locator('.studio-step-title').boundingBox();assert.ok(rect&&rect.y>=75&&rect.y+rect.height<844,'new step heading must be on screen');
   assert.ok(await page.locator('.studio-step-title').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'heading must not be covered');
  }
  assert.ok(await page.locator('[role=tab][aria-selected=true]').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'active tab must not be covered');
  await page.screenshot({path:`work/mobile-fixes/constructor-${width}.png`});
  assert.ok(await page.locator('.studio .preview').evaluate(e=>getComputedStyle(e).position!=='sticky'),'mobile preview must not obscure controls');
 });
 await check('cart readability and controls '+width,async()=>{
  await page.locator('#tab-extras').click();await page.locator('#add-cart').click();await page.locator('#open-cart').click();await page.waitForTimeout(450);
  assert.ok(await page.locator('#customer-name').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16),'input text must not trigger iOS autozoom');
  for(const locator of [page.locator('#close-cart'),page.locator('#cart-items [data-remove]').first()]){const r=await locator.boundingBox();assert.ok(r&&r.width>=44&&r.height>=44,'cart controls need 44px touch areas: '+JSON.stringify(r));}
  await page.locator('#export-order').scrollIntoViewIfNeeded();
  const close=await page.locator('#close-cart').boundingBox();assert.ok(close&&close.y>=0&&close.y+close.height<844,'close must remain available after scrolling');
  await page.screenshot({path:`work/mobile-fixes/cart-${width}.png`});await page.keyboard.press('Escape');
 });
 assert.deepEqual(errors,[]);await context.close();
}
await browser.close();if(failures)process.exitCode=1;
