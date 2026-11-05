import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const order=JSON.parse(await readFile('work/verification/order.json','utf8'));
const id=new URL(order.url).pathname.match(/order-received\/(\d+)/)[1];
assert.equal(new URL(order.url).hostname,'localhost');
const env=Object.fromEntries((await readFile('integrations/woocommerce/.env','utf8')).trim().split('\n').map(x=>x.split('=')));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
 const context=await browser.newContext();const page=await context.newPage();
 await page.goto('http://localhost:8088/wp-login.php',{waitUntil:'domcontentloaded'});
 await page.locator('#user_login').fill('woodbase-admin');await page.locator('#user_pass').fill(env.WP_ADMIN_PASSWORD);
 await Promise.all([page.waitForURL('**/wp-admin/**'),page.locator('#wp-submit').click()]);
 await page.goto('http://localhost:8088/wp-admin/admin.php?page=wc-orders&action=edit&id='+id,{waitUntil:'domcontentloaded'});
 await page.getByText('WoodBase: производственный снимок').click();
 assert.match(await page.locator('body').innerText(),/ТЕСТ WoodBase/);
 const link=page.getByRole('link',{name:'Скачать макет PNG'}).first();const url=await link.getAttribute('href');
 const response=await context.request.get(url);assert.equal(response.status(),200);assert.equal(response.headers()['content-type'],'image/png');
 const png=await response.body();assert.equal(png.subarray(1,4).toString(),'PNG');
 const missingNonce=new URL(url);missingNonce.searchParams.delete('_wpnonce');
 assert.equal((await context.request.get(missingNonce.href)).status(),403,'Even admin must supply a valid download nonce');
 const anon=await browser.newContext();assert.equal((await anon.request.get(url)).status(),403);await anon.close();
 await page.screenshot({path:'work/verification/order-admin.png',fullPage:true});
 console.log('PASS HPOS admin sees configuration, authorized PNG download, anonymous download denied');
} finally {await browser.close();}
