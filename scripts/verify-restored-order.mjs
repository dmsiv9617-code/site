import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const [origin,orderId,expectedHash]=process.argv.slice(2);
assert.equal(new URL(origin).hostname,'localhost','Restore UI probe must stay on loopback');
const env=Object.fromEntries((await readFile('integrations/woocommerce/.env','utf8')).trim().split('\n').map(x=>x.split('=')));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext();const page=await context.newPage();
 const login=await page.goto(origin+'/wp-login.php',{waitUntil:'domcontentloaded'});
 console.log('Restore login HTTP status:',login.status());
 const {writeFile}=await import('node:fs/promises');await writeFile('work/verification/restore-login.html',await page.content());
 await page.locator('#user_login').fill('woodbase-admin');await page.locator('#user_pass').fill(env.WP_ADMIN_PASSWORD);
 await Promise.all([page.waitForURL('**/wp-admin/**'),page.locator('#wp-submit').click()]);
 await page.goto(origin+'/wp-admin/admin.php?page=wc-orders&action=edit&id='+orderId,{waitUntil:'domcontentloaded'});
 await page.getByText('WoodBase: производственный снимок').click();
 assert.match(await page.locator('body').innerText(),/ТЕСТ WoodBase/);
 const url=await page.getByRole('link',{name:'Скачать макет PNG'}).first().getAttribute('href');
 const file=await page.evaluate(async url=>{const r=await fetch(url);return {status:r.status,bytes:Array.from(new Uint8Array(await r.arrayBuffer()))};},url);assert.equal(file.status,200);
 const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(Buffer.from(file.bytes)).digest('hex'),expectedHash);
 const anon=await browser.newContext();const anonymous=await anon.newPage();await anonymous.goto(origin+'/wp-login.php',{waitUntil:'domcontentloaded'});assert.equal(await anonymous.evaluate(async url=>(await fetch(url)).status,url),403);await anon.close();
 await page.screenshot({path:'work/verification/restored-order-admin.png',fullPage:true});
 console.log('PASS restored HPOS order visible in admin; downloaded PNG matches backup SHA256; anonymous access denied');
}finally{await browser.close();}
