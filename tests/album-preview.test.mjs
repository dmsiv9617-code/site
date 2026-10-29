import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAlbumPreview} from '../src/album-preview.js';

test('keep the decoded image during loading, ignore stale loads and crossfade for 400ms',async()=>{
 const originals={Image:globalThis.Image,document:globalThis.document,matchMedia:globalThis.matchMedia};
 const images=[],animations=[];
 class Node {
  children=[];isConnected=true;attributes={};dataset={};
  classList={add(){},remove(){}};
  append(node){node.parent=this;this.children.push(node);}
  replaceChildren(node){this.children.forEach(n=>n.isConnected=false);this.children=[];this.append(node);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.isConnected=false;}
  setAttribute(key,value){this.attributes[key]=value;}
  getAttribute(key){return key==='src'?this.src:this.attributes[key];}
  querySelector(){return this.status||(this.status={textContent:''});}
  animate(frames,timing){const animation={frames,timing,finished:new Promise(()=>{}),cancel(){}};animations.push(animation);return animation;}
 }
 try {
  globalThis.document={createElement:()=>new Node()};
  globalThis.matchMedia=()=>({matches:false,addEventListener(){}});
  globalThis.Image=class extends Node{constructor(){super();this.loaded=new Promise(resolve=>this.resolve=resolve);images.push(this);}decode(){return this.loaded;}};
  const container=new Node(),preview=createAlbumPreview(container);
  const first=preview.show('first.webp','First');images[0].resolve();await first;
  const second=preview.show('second.webp','Second');
  assert.ok(container.children[0].children.includes(images[0]),'previous image remains while loading');
  const latest=preview.show('latest.webp','Latest');images[1].resolve();await second;
  assert.ok(!container.children[0].children.includes(images[1]),'stale decoded image never appears');
  images[2].resolve();await latest;
  assert.equal(animations.length,2);
  assert.ok(animations.every(a=>a.timing.duration===400));
  assert.equal(animations[1].frames[0].transform,'scale(.98)');
  preview.reset();
  assert.ok(!container.children[0].children.includes(images[0]),'outgoing image is cleaned up');
 } finally {Object.assign(globalThis,originals);}
});
