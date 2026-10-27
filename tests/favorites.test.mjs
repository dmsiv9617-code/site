import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFavorites} from '../src/favorites.js';

function memory(initial='[]') { let value=initial; return {getItem:()=>value,setItem:(_,v)=>{value=v;}}; }
test('a selected album persists after a new store is created, and can be removed',()=>{
 const storage=memory(), first=createFavorites(storage,[1,2,3,4,5]);
 first.toggle(3); assert.equal(first.has(3),true);
 const reloaded=createFavorites(storage,[1,2,3,4,5]);
 assert.deepEqual(reloaded.list(),[3]); reloaded.toggle(3);
 assert.deepEqual(createFavorites(storage,[1,2,3,4,5]).list(),[]);
});
test('invalid saved data and unknown album ids cannot enter favorites',()=>{
 assert.deepEqual(createFavorites(memory('{broken'),[1,2]).list(),[]);
 const store=createFavorites(memory('[1,1,99,"2",null]'),[1,2]);
 assert.deepEqual(store.list(),[1]); store.toggle(99); assert.deepEqual(store.list(),[1]);
});
test('blocked browser storage still allows favorites for the current visit',()=>{
 const store=createFavorites({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},[3]);
 store.toggle(3); assert.equal(store.has(3),true);
 store.toggle(3); assert.equal(store.has(3),false);
});
