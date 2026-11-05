import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const profile=await mkdtemp('work/guest-profile-');const options={executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']};
let context;
try{
 context=await chromium.launchPersistentContext(profile,options);
 const api=context.request,base='http://localhost:5173';
 const p=await (await api.get(base+'/wp-json/woodbase/v1/product')).json();await api.get(base+'/wp-json/woodbase/v1/session');
 const first=await api.get(base+'/wp-json/wc/store/v1/cart');const token=first.headers()['cart-token'];
 const configuration={version:1,productId:p.id,options:{model:'moments',wood:'natural',binding:'bolts',leather:'black',motif:'moments',extras:[]},inscription:'Тест перезапуска',artwork:{fileId:null,x:0,y:0,scale:1,rotation:0,threshold:140,mode:'engrave'}};
 assert.equal((await api.post(base+'/wp-json/wc/store/v1/cart/add-item',{headers:{'Cart-Token':token},data:{id:p.id,quantity:1,extensions:{woodbase:{configuration,requestId:crypto.randomUUID()}}}})).status(),201);
 const before=(await context.cookies()).find(c=>c.name.startsWith('wp_woocommerce_session_'));assert.ok(before.httpOnly);assert.equal(before.sameSite,'Lax');assert.ok(before.expires>Date.now()/1000);
 await context.close();context=null;
 context=await chromium.launchPersistentContext(profile,options);
 const after=await context.request.get(base+'/wp-json/wc/store/v1/cart');const cart=await after.json();assert.equal(cart.items.length,1);assert.ok(cart.items[0].item_data.some(x=>x.value==='Тест перезапуска'));
 console.log('PASS actual Chromium close/reopen retains guest cart within persistent WC cookie lifetime');
}finally{if(context)await context.close();await rm(profile,{recursive:true,force:true});}
