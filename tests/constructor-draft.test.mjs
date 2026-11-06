import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDraftStore,makeDraft,parseDraft,cartMetadata} from '../src/constructor-draft.js';
const state={model:5,motif:5,color:3,leather:'brown',binding:'woven',inscription:'Наша история',extras:['box'],image:'data:image/png;base64,PRIVATE',imageScale:1.25,imageX:8,imageY:-7,imageRotation:15,threshold:160,imageMode:'original',page:2};
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};};
test('draft round-trips personalisation, artwork settings and active step without private files or credentials',()=>{
 const draft=makeDraft({...state,token:'secret',file:{bytes:'private'},price:1},'extras');const encoded=JSON.stringify(draft);
 assert.equal(draft.artworkRequired,true);assert.equal(draft.step,'extras');assert.equal(draft.configuration.image,undefined);
 assert.ok(!/PRIVATE|data:image|secret|token|file|price/.test(encoded));
 assert.deepEqual(parseDraft(encoded),draft);assert.equal(draft.configuration.imageScale,1.25);assert.deepEqual(draft.configuration.extras,['box']);
});
test('invalid, oversized or unsupported drafts cannot replace the default configuration',()=>{
 for(const raw of ['{','null','x'.repeat(20000),JSON.stringify({...makeDraft(state,'cover'),version:2}),JSON.stringify({...makeDraft(state,'cover'),configuration:{...state,color:99}})])assert.equal(parseDraft(raw),null);
 assert.equal(parseDraft(JSON.stringify({...makeDraft(state,'cover'),step:'secret'})),null);
});
test('save is synchronous, reload restores the last change and reset clears only draft keys',()=>{
 const storage=memory();storage.setItem('unrelated','keep');const a=createDraftStore(storage);assert.equal(a.save(state,'cover'),true);
 const loaded=createDraftStore(storage).load();assert.equal(loaded.status,'restored');assert.equal(loaded.draft.step,'cover');assert.equal(loaded.draft.configuration.inscription,state.inscription);
 assert.equal(a.clear(),true);assert.equal(a.load().status,'empty');assert.equal(storage.getItem('unrelated'),'keep');
});
test('legacy manually saved projects migrate metadata and delete persisted image payloads',()=>{
 const storage=memory();storage.setItem('woodbase-project',JSON.stringify({version:1,configuration:state}));const r=createDraftStore(storage).load();
 assert.equal(r.status,'restored');assert.equal(r.draft.artworkRequired,true);assert.equal(storage.getItem('woodbase-project'),null);assert.ok(![...storage.data.values()].join('').includes('PRIVATE'));
});
test('blocked or full browser storage reports failure without throwing or claiming persistence',()=>{
 const storage={getItem(){throw new Error('denied');},setItem(){throw new Error('full');},removeItem(){throw new Error('denied');}};const store=createDraftStore(storage);
 assert.equal(store.load().status,'unavailable');assert.equal(store.save(state,'cover'),false);assert.equal(store.clear(),false);
});
test('persisted demo cart contains metadata and original-required marker, never customer image bytes',()=>{
 const saved=cartMetadata({model:'Альбом',price:3540,extras:[],inscription:'Текст',image:state.image,configuration:state,artwork:{x:8},preview:'data:image/png;base64,PRIVATE',token:'secret'});
 assert.equal(saved.image,null);assert.equal(saved.artworkRequired,true);assert.equal(saved.configuration.image,null);assert.ok(!/PRIVATE|data:image|secret/.test(JSON.stringify(saved)));
 assert.equal(saved.inscription,'Текст');assert.equal(saved.configuration.imageX,8);
});
test('a readable saved draft can still be restored when storage becomes full or read-only',()=>{
 const storage=memory();assert.equal(createDraftStore(storage).save(state,'cover'),true);
 const readonly={...storage,setItem(){throw new Error('quota');}};
 const result=createDraftStore(readonly).load();assert.equal(result.status,'restored');assert.equal(result.draft.configuration.inscription,state.inscription);assert.equal(result.persisted,false);
});
