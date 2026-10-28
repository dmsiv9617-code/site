import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {variantFor,coverColors} from '../src/album-variants.js';
const models=Array.from({length:6},(_,i)=>({inscription:`design ${i}`}));
test('all 96 material combinations resolve to distinct complete WebP files',()=>{
 const paths=new Set();
 for(const model of [0,1,2,3,4,5]) for(let color=0;color<4;color++) for(const leather of ['black','brown']) for(const binding of ['bolts','woven']){
  const path=variantFor({model,motif:model,inscription:models[model].inscription,color,leather,binding},models);
  const url=new URL(path,'https://woodbase.test');
  assert.ok(url.pathname.endsWith(`-${coverColors[color]}-${leather}-${binding}.webp`));
  const file=new URL('../public'+url.pathname,import.meta.url);
  assert.ok(existsSync(file),path);
  const bytes=readFileSync(file);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.readUInt32LE(4)+8,bytes.length,'WebP must not be truncated: '+path);
  paths.add(path);
 }
 assert.equal(paths.size,96);
});
test('personalisation and unavailable designs never show a misleading generated photo',()=>{
 const c={model:5,motif:5,inscription:models[5].inscription,color:0,leather:'brown',binding:'woven'};
 assert.equal(variantFor({...c,image:'data:image/png;base64,test'},models),null);
 assert.equal(variantFor({...c,inscription:'My own text'},models),null);
 assert.equal(variantFor({...c,model:6,motif:6,inscription:'Unknown'},models),null);
});
test('older configurations default to black leather and keep original colour IDs',()=>{
 assert.ok(variantFor({model:0,motif:0,inscription:models[0].inscription,color:2,binding:'woven'},models).startsWith('/configurator-assets/family-black-black-woven.webp?v='));
});
