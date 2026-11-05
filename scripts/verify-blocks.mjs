// Diagnostic only: standalone Blocks page is not a supported frontend handoff yet.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox'],headless:true});
try {
 const context=await browser.newContext();const api=context.request;const base='http://localhost:8088';
 await api.get(base+'/wp-json/woodbase/v1/session');
 const initial=await api.get(base+'/wp-json/wc/store/v1/cart');const headers={'Cart-Token':initial.headers()['cart-token']};
 const config=JSON.parse(await readFile('work/verification/order.json','utf8')).configuration;config.artwork.fileId=null;
 const add=await api.post(base+'/wp-json/wc/store/v1/cart/add-item',{headers,data:{id:config.productId,quantity:1,extensions:{woodbase:{configuration:config,requestId:crypto.randomUUID()}}}});assert.equal(add.status(),201);
 const page=await context.newPage();await page.goto(base+'/checkout-blocks/',{waitUntil:'domcontentloaded'});
 await page.screenshot({path:'work/verification/blocks-entry.png'});
 const rendered=await page.locator('body').innerText();
 console.log(rendered.includes('Your cart is currently empty')?'KNOWN LIMITATION: standalone Blocks page shows empty cart':'Blocks page rendered; full interactive validation still required');
 const address={first_name:'Тест',last_name:'WoodBase',address_1:'Тестовая 1',address_2:'',city:'Москва',state:'Москва',postcode:'101000',country:'RU',email:'woodbase-test@example.test',phone:'+79990000000'};
 const result=await api.post(base+'/wp-json/wc/store/v1/checkout',{headers,data:{billing_address:address,shipping_address:address,payment_method:'bacs',payment_data:[],customer_note:'LOCAL BLOCKS API TEST'}});
 assert.equal(result.status(),200);assert.ok((await result.json()).order_id);
 console.log('PASS Store API guest checkout endpoint with local BACS; this does not certify Blocks UI or Ozon compatibility');
} finally {await browser.close();}
