import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configurationFromState, StoreCart} from '../src/commerce.js';
const state={model:5,motif:5,color:0,binding:'bolts',leather:'black',inscription:'Текст',extras:[],image:null,imageScale:1,imageX:0,imageY:0,imageRotation:0,imageMode:'engrave',threshold:140};
test('configuration has stable IDs and never sends browser prices or image data',()=>{
 const c=configurationFromState({...state,price:1},42);
 assert.equal(c.productId,42); assert.equal(c.options.wood,'natural'); assert.equal(c.version,1);
 assert.equal(c.price,undefined);assert.equal(c.image,undefined);
});
test('unmapped albums and unsaved customer images are rejected',()=>{
 assert.throws(()=>configurationFromState({...state,model:0},42));
 assert.throws(()=>configurationFromState({...state,image:'data:image/png;base64,xx'},42));
 assert.throws(()=>configurationFromState({...state,imageRotation:NaN},42));
});
test('Store API captures rotating cart token, sends configuration and preserves server errors',async()=>{
 const calls=[];let count=0;
 const client=new StoreCart('https://shop.example',async(url,options)=>{
  calls.push({url,options});count++;
  return new Response(JSON.stringify(count===3?{message:'Unavailable'}:{items:[]}),{status:count===3?409:200,headers:{'Cart-Token':'token-'+count}});
 });
 await client.get();await client.add(configurationFromState(state,42),'request-1');
 assert.equal(calls[1].options.headers['Cart-Token'],'token-1');
 const body=JSON.parse(calls[1].options.body);
 assert.equal(body.id,42);assert.equal(body.extensions.woodbase.configuration.productId,42);
 assert.equal(body.extensions.woodbase.requestId,'request-1');
 await assert.rejects(client.quantity('key',2),/Unavailable/);
 assert.equal(client.token,'token-3');
});
test('failed live requests never silently fall back to demo',async()=>{
 const client=new StoreCart('https://shop.example',async()=>{throw new Error('offline');});
 await assert.rejects(client.get(),/offline/);
});
test('default transport calls fetch with the browser global receiver',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async function(){assert.equal(this,globalThis);return new Response('{"items":[]}');};
 try{await new StoreCart('https://shop.example').get();}finally{globalThis.fetch=previous;}
});
