import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin=process.env.WB_HERO_ORIGIN||'http://localhost:5174';
assert.equal(new URL(origin).hostname,'localhost');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/opening-000.webp',async route=>{await gate;await route.continue();});
 await page.addInitScript(()=>{const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,x,y,w,h,...rest){if(this.canvas.classList.contains('green-scroll-canvas'))window.heroDraw={x,y,w,h};return original.call(this,image,x,y,w,h,...rest);};});
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.querySelector('#skip-intro')?.click());
 await page.waitForFunction(()=>document.querySelector('.hero-woody').style.width&&Number(getComputedStyle(document.querySelector('.hero-actions')).opacity)>.99);
 const initial=await page.locator('.hero-woody').boundingBox();
 assert.match(await page.locator('.hero-woody img').getAttribute('src'),/opening-000.webp/,'loading art must be the same animation frame');
 release();await page.waitForFunction(()=>!document.querySelector('.green-scroll-sequence').classList.contains('loading')&&window.heroDraw);
 const painted=await page.evaluate(()=>window.heroDraw);
 for(const [key,actual] of [['x',initial.x],['y',initial.y],['w',initial.width],['h',initial.height]])assert.ok(Math.abs(painted[key]-actual)<1,'loading and canvas geometry differ: '+key);
 await page.evaluate(()=>scrollTo({top:20,behavior:'instant'}));await page.waitForTimeout(100);const scrolled=await page.evaluate(()=>window.heroDraw);
 assert.ok(Math.abs(scrolled.w-painted.w)<1&&Math.abs(scrolled.h-painted.h)<1,'small first scroll must not enlarge Woody');
 assert.equal(await page.locator('.hero-invitation-line').count(),0);
 assert.equal(await page.locator('.hero-invitation-trail').count(),1);
 console.log('PASS loading frame → canvas → first scroll: identical size and placement');
}finally{await browser.close();}
