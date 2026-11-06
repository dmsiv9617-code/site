import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 for(const width of (process.env.WB_MOTION_WIDTH?[Number(process.env.WB_MOTION_WIDTH)]:[390,1440])){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},reducedMotion:'no-preference',hasTouch:width===390,isMobile:width===390});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5174/',{waitUntil:'domcontentloaded'});await page.waitForSelector('.concept-hero .wd');
  await page.evaluate(()=>document.querySelector('#skip-intro')?.click());
  await page.waitForFunction(()=>!document.querySelector('#preloader')&&!document.documentElement.classList.contains('intro-lock'));
  await page.waitForFunction(()=>[...document.querySelectorAll('.concept-hero .wd')].every(e=>Math.abs(new DOMMatrix(getComputedStyle(e).transform).m42)<1));
  await page.evaluate(()=>{const s=document.querySelector('.green-scroll-sequence');scrollTo({top:(s.offsetHeight-innerHeight)*.8,behavior:'instant'});});
  await page.waitForFunction(()=>Number(document.querySelector('.green-scroll-sequence').dataset.frame)>0);
  await page.locator('.cosmic-dots button').nth(2).evaluate(e=>e.click());await page.waitForFunction(()=>document.querySelector('.cosmic-title')?.textContent==='Начало твоей истории');
  assert.equal(await page.locator('.cosmic-title').innerText(),'Начало твоей истории');
  await page.locator('nav a[href="#constructor"]').click();await page.waitForTimeout(900);
  await page.waitForFunction(()=>[...document.querySelectorAll('[role=tab]')].every(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.builder')).opacity)===1);
  assert.equal(await page.locator('.builder').evaluate(e=>Number(getComputedStyle(e).opacity)),1,'scroll reveal completes');
  await page.locator('#tab-cover').click();await page.locator('#inscription').fill('Переходы сохранены');
  await page.locator('#tab-extras').click();await page.locator('#add-cart').click();
  assert.equal(await page.locator('#cart-count').innerText(),'1');assert.deepEqual(errors,[]);
  await page.screenshot({path:`docs/constructor-ux-assets/motion-${width}.jpg`,quality:85});
  console.log('PASS GSAP intro, hero reveal, Woody canvas, catalog transition, constructor and cart with motion at '+width+'px');
  await context.close();
 }
}finally{await browser.close();}
