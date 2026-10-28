import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {variantFor,coverColors} from '../src/album-variants.js';
const models=Array.from({length:6},(_,i)=>({inscription:`design ${i}`}));
test('all 80 material combinations resolve to distinct existing files',()=>{
 const paths=new Set();
 for(const model of [0,1,2,3,5]) for(let color=0;color<4;color++) for(const leather of ['black','brown']) for(const binding of ['bolts','woven']){
  const path=variantFor({model,motif:model,inscription:models[model].inscription,color,leather,binding},models);
  assert.ok(path?.endsWith(`-${coverColors[color]}-${leather}-${binding}.webp`));
  assert.ok(existsSync(new URL('../public'+path,import.meta.url)),path);paths.add(path);
 }
 assert.equal(paths.size,80);
});
test('personalisation and unavailable designs never show a misleading generated photo',()=>{
 const c={model:5,motif:5,inscription:models[5].inscription,color:0,leather:'brown',binding:'woven'};
 assert.equal(variantFor({...c,image:'data:image/png;base64,test'},models),null);
 assert.equal(variantFor({...c,inscription:'My own text'},models),null);
 assert.equal(variantFor({...c,model:4,motif:4,inscription:models[4].inscription},models),null);
});
test('older configurations default to black leather and keep original colour IDs',()=>{
 assert.equal(variantFor({model:0,motif:0,inscription:models[0].inscription,color:2,binding:'woven'},models),'/configurator-assets/family-black-black-woven.webp');
});
