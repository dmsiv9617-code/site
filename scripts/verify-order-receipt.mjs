// Real receipt DOM, with order API stubbed. No remote chats or real orders.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin=process.env.WB_RECEIPT_ORIGIN||'http://localhost:5173';
assert.equal(new URL(origin).hostname,'localhost');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const context=await browser.newContext();const page=await context.newPage();
 await page.route('**/receipt-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><button id="checkout">Оформить заказ</button>'}));
 const all=[{id:'telegram',url:'https://t.me/woodbase_test'},{id:'vk',url:'https://vk.me/club214537480'},{id:'max',url:'https://max.ru/u/test'}];
 for(const scenario of [
  ...all.map(channel=>({channel,method:'messenger'})),
  {channel:all[1],method:'callback'},
  {channel:all[1],method:'messenger',recover:true},
  {channel:all[1],method:'messenger',recover:true,removed:true},
  {channel:{id:'telegram',kind:'bot',url:'https://t.me/WoodBaseLazerBot'},method:'messenger'},
 ]){
  await page.goto(origin+'/receipt-test');
  await page.evaluate(async({scenario,all})=>{
   sessionStorage.clear();
   const {setupOrderCheckout}=await import('/src/order-checkout.js');
   const order={number:'38',method:scenario.method,channel:scenario.channel.id,total:'3540',currency:'RUB',items:[{name:'История',quantity:1,details:['Надпись: Семья']}],telegramStartUrl:'https://t.me/WoodBaseLazerBot?start=wb_'+'a'.repeat(48)};
   if(scenario.recover)sessionStorage.setItem('woodbase-checkout-request-v1','local-receipt-request');
   const channels=all.map(x=>x.id===scenario.channel.id?scenario.channel:x).filter(x=>!scenario.removed||x.id!==scenario.channel.id);
   setupOrderCheckout({button:document.querySelector('#checkout'),config:{version:1,privacyUrl:'/privacy/',consentUrl:'/consent/',messengers:channels},request:async()=>({order}),onSaved:()=>{}});
  },{scenario,all});
  await page.locator('#checkout').click();
  if(!scenario.recover){
   await page.locator(`input[name=method][value=${scenario.method}]`).check();
   await page.locator('select[name=channel]').selectOption(scenario.channel.id);
   if(scenario.method==='callback')await page.locator('input[name=contact]').fill('@local_test');
   await page.locator('input[name=consent]').check();await page.locator('.order-submit').click();
  }
  await page.locator('.order-receipt').waitFor({state:'visible'});
  const links=page.locator('.order-messenger-links a');
  assert.equal(await links.count(),scenario.method==='callback'||scenario.removed?0:1,'only the saved order channel appears');
  if(await links.count()){
   assert.ok((await links.first().getAttribute('href')).startsWith(scenario.channel.url));
   const text=await page.locator('.order-receipt').innerText();
   if(scenario.channel.id==='vk'||scenario.channel.id==='max')assert.doesNotMatch(text,/Telegram|бот/);
   if(scenario.channel.kind==='bot')assert.match(text,/Начать/);
  }
  if(scenario.removed)assert.match(await page.locator('.order-receipt').innerText(),/недоступен/);
 }
 await context.close();console.log('PASS receipt: selected VK/MAX/Telegram only, matching instructions, callback, recovery, removed channel and bot');
}finally{await browser.close();}
