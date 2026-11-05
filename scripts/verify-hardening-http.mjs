import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext();const api=context.request;const base='http://localhost:8088';
 const s=await (await api.get(base+'/wp-json/woodbase/v1/session')).json();
 const page=await context.newPage();const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=16;return c.toDataURL('image/png').split(',')[1];}),'base64');
 const upload=buffer=>api.post(base+'/wp-json/woodbase/v1/artwork',{headers:{'X-Woodbase-Nonce':s.nonce},multipart:{file:{name:'test.png',mimeType:'image/png',buffer}}});
 const parallel=await Promise.all(Array.from({length:6},()=>upload(png)));
 assert.ok(parallel.every(r=>r.status()===200),await Promise.all(parallel.map(async r=>({status:r.status(),body:await r.text()}))));
 const ids=await Promise.all(parallel.map(async r=>(await r.json()).fileId));assert.equal(new Set(ids).size,6);
 // Valid PNG header/IHDR, missing pixel data: accepted MIME/dimensions, rejected by decoder.
 for(let i=0;i<3;i++){const r=await upload(png.subarray(0,33));assert.equal(r.status(),400);assert.doesNotMatch(await r.text(),/var\/|SQL|Stack trace/);}
 assert.equal((await upload(png)).status(),200);
 const limit=await upload(png);assert.equal(limit.status(),429);assert.ok(Number(limit.headers()['retry-after'])>0);
 assert.match((await limit.json()).message,/[А-Яа-я]/);
 const second= new Date().getSeconds();if(second>20)await new Promise(r=>setTimeout(r,(61-second)*1000));
 const sessions=[];
 for(let batch=0;batch<10;batch++){
  const results=await Promise.all(Array.from({length:8},async(_,i)=>{const c=await browser.newContext();try{const r=await c.request.get(base+'/wp-json/woodbase/v1/session',{headers:{'X-Forwarded-For':`198.51.${batch}.${i+1}`}});if(r.status()===429)assert.ok(Number(r.headers()['retry-after'])>0);return r.status();}finally{await c.close();}}));sessions.push(...results);
 }
 assert.ok(sessions.includes(429),'Creating fresh cookies and forging XFF must not bypass the IP limit');
 console.log('PASS IP session-creation limit resists new cookies and forged XFF');
 console.log('PASS six parallel HTTP PNG uploads, decoder failure response safety, owner upload rate 429 and Retry-After');
}finally{await browser.close();}
