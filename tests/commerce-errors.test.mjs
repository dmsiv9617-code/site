import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commerceError} from '../src/commerce-errors.js';
test('HTTP errors are Russian and contain no backend paths or stack traces',()=>{
 for(const status of [400,401,403,404,409,413,429,500,503])assert.match(commerceError(status).message,/[А-Яа-я]/);
 assert.match(commerceError(429,'12').message,/12 сек/);
 assert.doesNotMatch(commerceError(503).message,/SQL|var\/|stack/i);
});
