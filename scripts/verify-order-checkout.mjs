// Real local WooCommerce test: no external chats or production orders.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,readFile} from 'node:fs/promises';
const origin=process.env.WB_ORDER_ORIGIN||'http://localhost:5173';assert.equal(new URL(origin).hostname,'localhost');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});await mkdir('work/order-checkout',{recursive:true});
try{
 for(const [width,method,loggedIn] of [[390,'callback'],[1366,'messenger'],[1366,'messenger',true]]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<700,hasTouch:width<700,reducedMotion:'reduce'}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(loggedIn){
   const values=Object.fromEntries((await readFile('integrations/woocommerce/.env','utf8')).trim().split('\n').map(line=>line.split('=')));
   await context.request.get('http://localhost:8088/wp-login.php');
   await context.request.post('http://localhost:8088/wp-login.php',{form:{log:'woodbase-admin',pwd:values.WP_ADMIN_PASSWORD,testcookie:'1',redirect_to:'http://localhost:8088/wp-admin/'}});
   assert.ok((await context.cookies()).some(x=>x.name.startsWith('wordpress_logged_in_')),'local administrator authenticated');
   const response=await context.request.get('http://localhost:8088/wp-json/wc/store/v1/cart');
   const token=response.headers()['cart-token'];
   for(const item of (await response.json()).items)await context.request.post('http://localhost:8088/wp-json/wc/store/v1/cart/remove-item',{headers:{'Cart-Token':token},data:{key:item.key}});
  }
  await page.goto(origin+'/#constructor');await page.evaluate(()=>document.querySelector('#skip-intro')?.click());await page.waitForFunction(()=>!document.querySelector('#add-cart').disabled);
  await page.locator('#tab-cover').click();await page.evaluate(()=>{const m=document.querySelector('#model');m.value='5';m.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#inscription').fill('Семья Проверкиных');await page.locator('#tab-extras').click();await page.locator('.extra input[value="box"]').check();await page.locator('#add-cart').click();await page.waitForFunction(()=>document.querySelector('#cart-count').textContent==='1');
  await page.locator('#open-cart').click();await page.getByRole('button',{name:'Оформить заказ',exact:true}).click();await page.locator('#order-checkout').waitFor({state:'visible'});
  if(method==='messenger')await page.locator('input[name=method][value=messenger]').check();
  else await page.locator('#order-checkout input[name=contact]').fill('@local_test_buyer');
  await page.locator('input[name=consent]').check();
  assert.equal(await page.locator('#order-checkout').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'no horizontal scroll');
  await page.screenshot({path:`work/order-checkout/form-${width}.png`});
  await page.locator('.order-submit').focus();await page.keyboard.press('Tab');
  // Chromium may briefly move focus to browser chrome at the end of a native dialog.
  if(await page.evaluate(()=>document.activeElement===document.body))await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(()=>!!document.activeElement.closest('#order-checkout')),'keyboard cycles back into the active dialog');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#order-checkout').evaluate(e=>e.open),false);await page.locator('.commerce-checkout').click();
  let firstOrder=null,payload=null,once=false;
  await page.route('**/woodbase/v1/orders',async route=>{
   payload=route.request().postDataJSON();
   if(!once){once=true;const response=await route.fetch();assert.equal(response.status(),200);firstOrder=(await response.json()).order;await route.abort('failed');}
   else await route.continue();
  });
  await page.locator('.order-submit').click();await page.waitForFunction(()=>!document.querySelector('.order-submit').disabled);
  assert.match(await page.locator('.order-result').innerText(),/Не удалось|Повторите/);
  assert.ok(await page.locator('.order-receipt').isHidden(),'failed response cannot falsely confirm a save');
  await page.locator('.order-submit').click();await page.locator('.order-receipt').waitFor({state:'visible'});
  assert.match(await page.locator('.order-receipt h3').innerText(),new RegExp(firstOrder.number));
  assert.doesNotMatch(await page.locator('.order-receipt').innerText(),/бот/,'direct chat receipt must not mention a bot');
  assert.match(await page.locator('.order-receipt textarea').inputValue(),/Семья Проверкиных/);
  assert.match(await page.locator('.order-receipt textarea').inputValue(),/3\s?890/);
  assert.equal(await page.locator('.order-messenger-links a').count(),1);assert.match(await page.locator('.order-messenger-links a').getAttribute('href'),/^https:\/\/t.me\/woodbase_test\?text=/);
  await page.screenshot({path:`work/order-checkout/saved-${width}.png`});
  await page.reload();await page.waitForFunction(()=>document.querySelector('.commerce-checkout')?.textContent==='Ваш сохранённый заказ');await page.locator('#open-cart').click();await page.locator('.commerce-checkout').click();await page.locator('.order-receipt').waitFor({state:'visible'});assert.match(await page.locator('.order-receipt h3').innerText(),new RegExp(firstOrder.number));
  // A second browser session cannot read the order from its number/request ID.
  const other=await browser.newContext();const outsider=await other.newPage();await outsider.goto(origin);const recovery=await outsider.evaluate(async payload=>{const s=await fetch('/wp-json/woodbase/v1/session').then(r=>r.json());return fetch('/wp-json/woodbase/v1/orders/recover',{method:'POST',headers:{'Content-Type':'application/json','X-Woodbase-Nonce':s.nonce},body:JSON.stringify(payload)}).then(r=>r.json());},{requestId:payload.requestId});assert.equal(recovery.order,null);await other.close();
  assert.deepEqual(errors,[]);console.log('PASS real browser → WooCommerce → order → lost response retry → reload recovery → session isolation',width,method);await context.close();
 }
}finally{await browser.close();}
