import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],api=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/wp-json/'))api.push(r.url());});
 await page.goto('http://localhost:5174/#constructor');await page.evaluate(()=>document.querySelector('#skip-intro')?.click());
 assert.match(await page.locator('.commerce-mode').textContent(),/Демо/);
 await page.evaluate(()=>{document.querySelector('#add-cart').click();document.querySelector('#save-project').click();});
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sloy-cart')).length),1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('woodbase-project')).version),1);
 await page.reload();await page.evaluate(()=>document.querySelector('#skip-intro')?.click());
 assert.equal(await page.locator('#cart-count').textContent(),'1');
 assert.ok(await page.locator('#preloader').evaluateAll(nodes=>!nodes.length||getComputedStyle(nodes[0]).display==='none'));
 await page.screenshot({path:'work/verification/demo-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'work/verification/demo-mobile.png'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);assert.deepEqual(api,[]);
 console.log('PASS offline demo has no Woo requests, draft cart/project persist, intro skip works, 390px and 1440px without JS errors');
}finally{await browser.close();}
