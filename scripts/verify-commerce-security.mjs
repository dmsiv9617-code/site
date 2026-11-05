import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox'],headless:true});
try{
 const context=await browser.newContext();const api=context.request;const base='http://localhost:8088';
 const session=await (await api.get(base+'/wp-json/woodbase/v1/session')).json();
 const product=await (await api.get(base+'/wp-json/woodbase/v1/product')).json();
 const initial=await api.get(base+'/wp-json/wc/store/v1/cart');const headers={'Cart-Token':initial.headers()['cart-token']};
 const configuration={version:1,productId:product.id,options:{model:'moments',wood:'natural',binding:'bolts',leather:'black',motif:'moments',extras:[]},inscription:'Concurrent test',artwork:{fileId:null,x:0,y:0,rotation:0,scale:1,threshold:140,mode:'engrave'}};
 const data={id:product.id,quantity:1,extensions:{woodbase:{configuration,requestId:crypto.randomUUID()}}};
 const statuses=await Promise.all([1,2].map(async()=> (await api.post(base+'/wp-json/wc/store/v1/cart/add-item',{headers,data})).status()));
 assert.deepEqual(statuses.sort(),[201,409]);
 assert.equal((await api.post(base+'/wp-json/wc/store/v1/cart/add-item',{headers,data})).status(),409);
 const cart=await (await api.get(base+'/wp-json/wc/store/v1/cart',{headers})).json();assert.equal(cart.items.length,1);assert.equal(cart.items[0].quantity,1);
 for(const patch of [{options:{...configuration.options,extras:['box']}},{inscription:'<script>x</script>'},{artwork:{...configuration.artwork,rotation:999}},{version:2}]){
  const bad=structuredClone(data);bad.extensions.woodbase.requestId=crypto.randomUUID();Object.assign(bad.extensions.woodbase.configuration,patch);
  assert.equal((await api.post(base+'/wp-json/wc/store/v1/cart/add-item',{headers,data:bad})).status(),400);
 }
 const oversized=await api.post(base+'/wp-json/woodbase/v1/artwork',{headers:{'X-Woodbase-Nonce':session.nonce},multipart:{file:{name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1)}}});assert.equal(oversized.status(),413);
 const guest=await browser.newContext();
 const guestSession=await (await guest.request.get(base+'/wp-json/woodbase/v1/session')).json();
 const guestCart=await (await guest.request.get(base+'/wp-json/wc/store/v1/cart')).json();
 assert.notEqual(guestSession.nonce,session.nonce,'Guest session nonces must be isolated');
 assert.equal(guestCart.items.length,0,'A different guest must not inherit the first cart');
 await guest.close();
 const page=await context.newPage();await page.route('**/woodbase/v1/product',route=>route.fulfill({status:503,contentType:'application/json',body:'{"message":"test outage"}'}));
 await page.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('.commerce-mode')?.textContent.startsWith('WooCommerce недоступен'));
 assert.ok(await page.locator('#add-cart').isDisabled());
 console.log('PASS concurrent replay protection, server invalid options/text/placement/version, oversized upload, live outage blocks checkout without demo fallback');
}finally{await browser.close();}
