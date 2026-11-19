import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const origin=process.env.WB_TEST_ORIGIN||'http://localhost:5174';assert.equal(new URL(origin).hostname,'localhost');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
await mkdir('work/storefront-upgrades',{recursive:true});
try{
 for(const width of [390,768,1366,1920]){
  const context=await browser.newContext({viewport:{width,height:width===1366?768:900},reducedMotion:'reduce',isMobile:width<701,hasTouch:width<701});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/#constructor');await page.evaluate(()=>document.querySelector('#skip-intro')?.click());
  await page.locator('#tab-cover').click();await page.waitForFunction(()=>document.querySelector('#live-album .configured-album.is-ready'));
  const cover=await page.locator('#live-album img').getAttribute('src');
  await page.getByRole('textbox',{name:'Надпись на обложке',exact:true}).fill('Наши воспоминания');
  assert.equal(await page.locator('#live-album img').getAttribute('src'),cover,'custom inscription must not discard the original detailed cover');
  assert.match(await page.locator('#preview-personalization').innerText(),/Наши воспоминания/);
  if(width>700){assert.ok(await page.locator('.config-wizard').evaluate(e=>getComputedStyle(e).overflowY==='visible'),'desktop settings must not use a nested scroller');}
  else{assert.equal(await page.locator('.preview').evaluate(e=>getComputedStyle(e).position),'relative','mobile layout must keep its existing non-sticky preview');}
  await page.screenshot({path:`work/storefront-upgrades/constructor-${width}.png`});
  await page.locator('#tab-extras').click();for(const id of ['box','metric','pages','extra-corners'])await page.locator(`.extra input[value="${id}"]`).check();
  assert.match(await page.locator('#price').innerText(),/4\s*425/);
  await page.reload();await page.locator('#tab-extras').waitFor();assert.match(await page.locator('#price').innerText(),/4\s*425/,'additional options must survive reload');
  await page.locator('#add-cart').click();await page.locator('#open-cart').click();assert.equal(await page.locator('#cart .cart-cover').count(),1);assert.match(await page.locator('#cart-items').innerText(),/Наши воспоминания/);await page.keyboard.press('Escape');
  await page.locator('header nav a[href="#catalog"]').evaluate(e=>e.click());await page.waitForTimeout(200);
  await page.getByRole('button',{name:'Все альбомы',exact:true}).click();assert.equal(await page.locator('[data-overview-model]').count(),6);
  await page.locator('[data-overview-model="3"]').click();assert.ok(await page.locator('#product-detail').evaluate(e=>e.open));
  assert.equal(await page.locator('[data-gallery-src]').count(),3);await page.locator('[data-gallery-src]').nth(1).click();
  assert.match(await page.locator('.gallery-caption').innerText(),/разворота/);await page.locator('.gallery-main').click();assert.ok(await page.locator('#image-viewer').evaluate(e=>e.open));
  await page.keyboard.press('Escape');assert.ok(await page.locator('#product-detail').evaluate(e=>e.open));await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('link',{name:'Группа ВКонтакте',exact:true}).getAttribute('href'),'https://vk.ru/woodbase');
  assert.deepEqual(errors,[]);console.log('PASS cover fidelity, readable workspace, four additions, cart, gallery and overview',width);
  await context.close();
 }
}finally{await browser.close();}
