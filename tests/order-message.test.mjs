import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderMessage,messengerLink} from '../src/order-checkout.js';
test('message includes server order number, every item and total',()=>{
 const text=orderMessage({number:'1042',total:'4425',currency:'RUB',items:[{name:'История',quantity:2,details:['Надпись: Семья Ивановых','Упаковка']} ]});
 assert.match(text,/1042/);assert.match(text,/История.*2/);assert.match(text,/Семья Ивановых/);assert.match(text,/4\s?425/);
});
test('only verified direct Telegram chats get a prepared text; other channels use copy and open',()=>{
 assert.match(messengerLink({id:'telegram',url:'https://t.me/woodbase_test'},'Заказ №1'),/\?text=/);
 assert.equal(messengerLink({id:'vk',url:'https://vk.me/woodbase'},'Заказ №1'),'https://vk.me/woodbase');
 assert.equal(messengerLink({id:'telegram',url:'javascript:alert(1)'},'Заказ'),null);
 assert.equal(messengerLink({id:'telegram',url:'https://evil.example'},'Заказ'),null);
});
test('Telegram bot uses an opaque server start link and never text or a guessed order number',()=>{
 const bot={id:'telegram',kind:'bot',url:'https://t.me/WoodBaseLazerBot'};
 const url='https://t.me/WoodBaseLazerBot?start=wb_'+ 'a'.repeat(48);
 assert.equal(messengerLink(bot,'private inscription',{telegramStartUrl:url}),url);
 assert.equal(messengerLink(bot,'private inscription',{}),null);
 assert.equal(messengerLink(bot,'private inscription',{telegramStartUrl:'https://t.me/another_bot?start=wb_'+ 'a'.repeat(48)}),null);
});
