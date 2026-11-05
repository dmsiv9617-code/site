import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext();const page=await context.newPage();
 const data=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=c.height=2048;const ctx=c.getContext('2d'),image=ctx.createImageData(2048,2048);let seed=7;
  for(let i=0;i<image.data.length;i+=4){for(let j=0;j<3;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;image.data[i+j]=seed>>>24;}image.data[i+3]=255;}
  ctx.putImageData(image,0,0);return c.toDataURL('image/jpeg',.9).split(',')[1];
 });
 const buffer=Buffer.from(data,'base64');assert.ok(buffer.length>2*1024*1024&&buffer.length<5*1024*1024);
 const base='http://localhost:8088';const session=await (await context.request.get(base+'/wp-json/woodbase/v1/session')).json();
 const response=await context.request.post(base+'/wp-json/woodbase/v1/artwork',{headers:{'X-Woodbase-Nonce':session.nonce},multipart:{file:{name:'test-large.jpg',mimeType:'image/jpeg',buffer}}});
 assert.equal(response.status(),200,await response.text());const result=await response.json();assert.equal(result.width,2048);
 console.log('PASS valid JPEG larger than PHP default 2 MiB and smaller than declared 5 MiB is privately normalized and saved');
}finally{await browser.close();}
