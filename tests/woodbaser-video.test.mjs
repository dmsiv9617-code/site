import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveVideo} from '../src/woodbaser-source.js';
const link='https://disk.yandex.ru/i/DzCimnlpvVKhjA';
test('each viewing obtains a fresh media address from the permanent public link',async()=>{
 const requests=[];
 const fetcher=async url=>{requests.push(new URL(url));return {ok:true,json:async()=>({href:`https://downloader.disk.yandex.ru/video-${requests.length}`})};};
 assert.equal(await resolveVideo(link,{fetcher}),'https://downloader.disk.yandex.ru/video-1');
 assert.equal(await resolveVideo(link,{fetcher}),'https://downloader.disk.yandex.ru/video-2');
 assert.equal(requests[0].searchParams.get('public_key'),link);
});
test('unavailable media produces an actionable error',async()=>{
 await assert.rejects(resolveVideo(link,{fetcher:async()=>({ok:false,status:403})}),/Не удалось загрузить серию/);
});
test('invalid media URLs cannot be assigned to the player',async()=>{
 for(const href of [undefined,'javascript:alert(1)','http://example.com/video.mp4']){
  await assert.rejects(resolveVideo(link,{fetcher:async()=>({ok:true,json:async()=>({href})})}),/Не удалось получить адрес видео/);
 }
});
