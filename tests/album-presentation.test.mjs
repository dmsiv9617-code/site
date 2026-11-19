import {test} from 'node:test';
import assert from 'node:assert/strict';
import {albumPresentation} from '../src/album-presentation.js';
import {variantFor} from '../src/album-variants.js';
const models=Array.from({length:6},(_,i)=>({inscription:'design '+i}));
const selection={model:3,motif:3,color:1,leather:'brown',binding:'woven',inscription:'design 3'};
test('custom text retains the selected detailed cover as an explicitly marked reference',()=>{
 const c={...selection,inscription:'Наши воспоминания'};
 const before=structuredClone(c);const view=albumPresentation(c,models);
 assert.equal(view.source,variantFor(selection,models));assert.equal(view.reference,true);assert.deepEqual(c,before);
});
test('changing motif references that design with the selected materials',()=>{
 const view=albumPresentation({...selection,motif:1,inscription:'Мой текст'},models);
 assert.equal(view.source,variantFor({...selection,model:1,motif:1,inscription:models[1].inscription},models));assert.equal(view.reference,true);
});
test('uploaded or missing originals never masquerade as the pictured engraving',()=>{
 assert.equal(albumPresentation({...selection,image:'data:image/png,test'},models).source,null);
 assert.equal(albumPresentation({...selection,artworkRequired:true},models).source,null);
});
