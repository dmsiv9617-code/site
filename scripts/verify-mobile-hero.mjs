import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const origin=process.env.WB_HERO_ORIGIN||'http://localhost:5174';
assert.equal(new URL(origin).hostname,'localhost');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
await mkdir('work/mobile-hero',{recursive:true});
try{
 for(const [width,height] of [[360,640],[375,700],[320,568],[390,844],[430,932]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto(origin);await page.evaluate(()=>document.querySelector('#skip-intro')?.click());
  await page.waitForFunction(()=>!document.querySelector('.green-scroll-sequence').classList.contains('loading'));
  const check=async()=>{
   await page.waitForFunction(()=>{const c=document.querySelector('.green-scroll-canvas');return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>128);});
   await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.hero-actions')).opacity)>.99&&[...document.querySelectorAll('.concept-hero .wd')].every(e=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(e).transform).m42)<.5));
   const geometry=await page.evaluate(()=>{
    const hero=document.querySelector('.concept-hero'),photo=hero.querySelector('.hero-photo'),copy=hero.querySelector('.hero-copy'),canvas=hero.querySelector('canvas');
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let first=canvas.height,last=-1;
    for(let y=0;y<canvas.height;y+=2)for(let x=0;x<canvas.width;x+=2)if(pixels[(y*canvas.width+x)*4+3]>128){first=Math.min(first,y);last=Math.max(last,y);}
    return {viewport:innerHeight,hero:hero.getBoundingClientRect().toJSON(),photo:photo.getBoundingClientRect().toJSON(),copyBottom:copy.getBoundingClientRect().bottom,avatarTop:first/canvas.height*hero.clientHeight,avatarBottom:last/canvas.height*hero.clientHeight};
   });
   assert.ok(Math.abs(geometry.hero.height-geometry.viewport)<2,'hero must fill the dynamic viewport: '+JSON.stringify(geometry));
   assert.ok(geometry.photo.top<=1&&geometry.photo.bottom>=geometry.viewport-1,'background must cover the whole hero: '+JSON.stringify(geometry));
   assert.ok(geometry.avatarBottom>=geometry.viewport-5,'Woody must meet the bottom edge: '+JSON.stringify(geometry));
   assert.ok(geometry.avatarTop>=geometry.copyBottom+12,'Woody must not overlap the invitation: '+JSON.stringify(geometry));
   return geometry;
  };
  await check();await page.screenshot({path:`work/mobile-hero/${width}-${height}.png`});
  assert.equal(await page.locator('.mobile-hero-cta').count(),0,'no separate pill CTA');
  await page.locator('.hero-invitation').tap();await page.waitForURL('**/#constructor');assert.ok(await page.locator('#tab-binding').isVisible());
  await page.goto(origin);await page.waitForFunction(()=>!document.querySelector('.green-scroll-sequence').classList.contains('loading'));
  const beforeResize=await check();
  await page.setViewportSize({width,height:height+70});await page.waitForTimeout(200);const afterResize=await check();
  assert.ok(Math.abs((afterResize.avatarBottom-afterResize.avatarTop)-(beforeResize.avatarBottom-beforeResize.avatarTop))<4,'browser toolbar height changes must not suddenly resize Woody');
  console.log('PASS hero background, bottom placement, invitation and viewport resize',width,height);await context.close();
 }
}finally{await browser.close();}
