import {test} from 'node:test';import assert from 'node:assert/strict';
import {extrasTotal,supportsPaidExtras} from '../src/extras.js';
test('agreed additions total 765 for packaging, metric and additional pages',()=>{assert.equal(extrasTotal(['box','metric','pages']),765);assert.equal(extrasTotal(['box','box','corners','extra-corners']),470);});
test('live pricing requires both a server whitelist and a numeric server price',()=>{
 assert.equal(supportsPaidExtras({options:{extras:{box:'Box'}}},['box']),false);
 assert.equal(supportsPaidExtras({options:{extras:{box:'Box'}},extraPrices:{box:350}},['box']),true);
 assert.equal(supportsPaidExtras(null,[]),true);
});
