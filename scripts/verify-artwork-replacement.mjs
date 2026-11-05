import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage();const uploads=[],adds=[];
 page.on('response',r=>{if(r.url().endsWith('/woodbase/v1/artwork')&&r.ok())uploads.push(r.json());});
 page.on('request',r=>{if(r.url().endsWith('/cart/add-item'))adds.push(r.postDataJSON());});
 await page.goto('http://localhost:5173/#constructor',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('.commerce-mode')?.textContent.startsWith('Тестовый WooCommerce'));
 await page.evaluate(()=>{document.querySelector('#skip-intro')?.click();const m=document.querySelector('#model');m.value='5';m.dispatchEvent(new Event('change',{bubbles:true}));});
 const previews=[];
 for(const size of [600,1200]) {
  const data=await page.evaluate(size=>{const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').fillRect(0,0,size,size);return c.toDataURL('image/png').split(',')[1];},size);
  await page.locator('#upload').setInputFiles({name:`original-${size}.png`,mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await page.waitForFunction(()=>document.querySelector('#upload-status').textContent.startsWith('Рисунок загружен'));
  // File decoding is asynchronous: wait for the new preview before clicking add.
  await page.waitForTimeout(200);
  previews.push(await page.locator('#upload-thumb-img').getAttribute('src'));
  await page.evaluate(()=>document.querySelector('#add-cart').click());
  await page.waitForFunction(()=>!document.querySelector('#add-cart').disabled);
  assert.match(await page.locator('#cart-status').textContent(),/сохранён в тестовой корзине/);
 }
 assert.equal(previews[0],previews[1],'Fixture must produce identical 600px previews');
 const saved=await Promise.all(uploads);
 assert.equal(saved.length,2,'Replacing the original must upload it even when the preview matches');
 assert.deepEqual(saved.map(x=>x.width),[600,1200]);
 assert.notEqual(adds[0].extensions.woodbase.configuration.artwork.fileId,adds[1].extensions.woodbase.configuration.artwork.fileId);
 console.log('PASS distinct originals with identical previews retain distinct full-resolution private files');
} finally {await browser.close();}
