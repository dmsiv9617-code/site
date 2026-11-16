import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveVideo} from '../src/woodbaser-source.js';
const folder='https://disk.yandex.ru/d/rWsrOMMdmLKkCg';
test('folder video passes its exact Unicode file path to Yandex',async()=>{
 let requested;
 const path='/Панда и мед.mp4';
 const href=await resolveVideo(folder,{path,fetcher:async url=>{requested=new URL(url);return {ok:true,json:async()=>({href:'https://example.com/video.mp4'})};}});
 assert.equal(requested.searchParams.get('public_key'),folder);
 assert.equal(requested.searchParams.get('path'),path);
 assert.equal(href,'https://example.com/video.mp4');
});
test('standalone videos still resolve without a folder path and refresh each time',async()=>{
 let count=0;
 const fetcher=async url=>{assert.equal(new URL(url).searchParams.has('path'),false);return {ok:true,json:async()=>({href:`https://example.com/video-${++count}.mp4`})};};
 assert.notEqual(await resolveVideo('https://disk.yandex.ru/i/MRr1CdmhFyZpFg',{fetcher}),await resolveVideo('https://disk.yandex.ru/i/MRr1CdmhFyZpFg',{fetcher}));
});
test('invalid playback addresses and API errors remain recoverable',async()=>{
 await assert.rejects(resolveVideo(folder,{fetcher:async()=>({ok:false})}));
 await assert.rejects(resolveVideo(folder,{fetcher:async()=>({ok:true,json:async()=>({href:'http://example.com/video'})})}));
});
