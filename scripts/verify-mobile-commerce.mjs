// Browser contract check only: local WooCommerce-shaped responses, no real orders.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {albumIds} from '../src/commerce.js';
import {paidExtras} from '../src/extras.js';
const origin=process.env.WB_COMMERCE_ORIGIN||'http://localhost:5173';
assert.equal(new URL(origin).hostname,'localhost');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await context.newPage();let cartItems=[],nextKey=0;
const prices={currency_code:'RUB',currency_minor_unit:2,price:'354000'};
const product={id:6,name:'Счастливые моменты',description:'Локальная проверка интерфейса',price:'3540',currency:'RUB',purchasable:true,images:[],checkoutUrl:origin+'/checkout/',products:albumIds.map((model,i)=>({model,id:i+1,price:'3540',purchasable:true})),options:Object.fromEntries(Object.entries({model:albumIds,motif:albumIds,wood:['natural','walnut','black','copper'],leather:['black','brown'],binding:['bolts','woven'],extras:['corners','markers','stickers']}).map(([key,values])=>[key,Object.fromEntries(values.map(v=>[v,v]))]))};
await page.route('**/wp-json/**',async route=>{
 const path=new URL(route.request().url()).pathname;
 let data;
 if(path.endsWith('/product'))data=product;
 else if(path.endsWith('/session'))data={nonce:'local-browser-fixture'};
 else{
  const body=route.request().postDataJSON();
  if(path.endsWith('/add-item')){const config=body.extensions.woodbase.configuration;cartItems.push({key:String(++nextKey),name:'Альбом',quantity:1,prices,totals:{line_total:'354000'},item_data:[{key:'Надпись',value:config.inscription}]});}
  if(path.endsWith('/remove-item'))cartItems=cartItems.filter(x=>x.key!==body.key);
  if(path.endsWith('/update-item'))cartItems.find(x=>x.key===body.key).quantity=body.quantity;
  data={items:cartItems,totals:{...prices,total_price:String(cartItems.reduce((n,x)=>n+x.quantity*354000,0))}};
 }
 await route.fulfill({json:data,headers:{'Cart-Token':'local-browser-cart'}});
});
try{
 await page.goto(origin+'/#constructor');await page.evaluate(()=>document.querySelector('#skip-intro')?.click());
 await page.waitForFunction(()=>!document.querySelector('#add-cart').disabled);
 await page.locator('#tab-extras').click();
 await page.locator('.extra input[value="box"]').check();
 assert.ok(await page.locator('#add-cart').isDisabled(),'old backend cannot accept unpaid additions');
 assert.match(await page.locator('.commerce-mode').innerText(),/Дополнения пока оформляются/);
 await page.locator('.extra input[value="box"]').uncheck();
 assert.ok(await page.locator('#add-cart').isEnabled(),'base album remains available');
 await page.locator('#tab-cover').click();await page.locator('#inscription').fill('Мобильная проверка');
 await page.locator('#tab-extras').click();await page.locator('#add-cart').click();await page.waitForFunction(()=>document.querySelector('#cart-count').textContent==='1');
 await page.locator('#open-cart').click();await page.waitForTimeout(450);
 assert.ok(await page.locator('#telegram-request').isHidden(),'WooCommerce must not expose demo checkout');
 await page.locator('.commerce-checkout').waitFor({state:'visible'});assert.equal(await page.locator('.commerce-checkout').getAttribute('href'),product.checkoutUrl);
 const checkout=await page.locator('.commerce-checkout').boundingBox();assert.ok(checkout&&checkout.y>=0&&checkout.y+checkout.height<844,'WooCommerce checkout must be visible');
 assert.match(await page.locator('#cart-items').innerText(),/Мобильная проверка/);
 await page.getByRole('spinbutton').fill('2');await page.getByRole('spinbutton').press('Tab');await page.waitForFunction(()=>document.querySelector('#cart-count').textContent==='2');
 await page.screenshot({path:'work/mobile-fixes/woocommerce-cart.png'});
 await page.getByRole('button',{name:'Удалить',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#cart-count').textContent==='0');
 assert.ok(await page.locator('.commerce-checkout').isHidden(),'empty cart cannot offer checkout');
 await page.keyboard.press('Escape');
 product.extraPrices=Object.fromEntries(paidExtras.map(x=>[x.id,x.price]));
 Object.assign(product.options.extras,Object.fromEntries(paidExtras.map(x=>[x.id,x.name])));
 let received;
 await page.route('**/cart/add-item',async route=>{
  received=route.request().postDataJSON();
  await route.fulfill({json:{items:[{key:'priced',name:'Альбом с дополнениями',quantity:1,prices:{...prices,price:'442500'},totals:{line_total:'442500'},item_data:[]}],totals:{...prices,total_price:'442500'}},headers:{'Cart-Token':'local-browser-cart'}});
 });
 await page.route('**/wc/store/v1/cart',async route=>route.fulfill({json:{items:[{key:'priced',name:'Альбом с дополнениями',quantity:1,prices:{...prices,price:'442500'},totals:{line_total:'442500'},item_data:[]}],totals:{...prices,total_price:'442500'}},headers:{'Cart-Token':'local-browser-cart'}}));
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#add-cart').disabled);
 await page.locator('#tab-extras').click();
 for(const extra of paidExtras)await page.locator(`.extra input[value="${extra.id}"]`).check();
 assert.match(await page.locator('#price').innerText(),/4\s*425/);
 await page.locator('#add-cart').click();await page.waitForFunction(()=>document.querySelector('#cart-status').textContent==='Альбом добавлен в корзину');
 assert.deepEqual(received.extensions.woodbase.configuration.options.extras.slice().sort(),paidExtras.map(x=>x.id).sort());
 assert.ok(!/"(?:price|total|extraPrices)"/.test(JSON.stringify(received)),'prices must never be submitted as browser authority');
 await page.locator('#open-cart').click();assert.match(await page.locator('#cart-items').innerText(),/4\s*425/);
 console.log('PASS paid additions: old backend blocked, compatible backend accepted, server cart total displayed, no submitted prices');
 console.log('PASS mobile WooCommerce UI: personalization, quantity, removal, sticky checkout and no demo action (local API fixtures)');
}finally{await browser.close();}
