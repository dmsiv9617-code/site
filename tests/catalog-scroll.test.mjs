import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogFadeLength, catalogProgress, catalogScrollTop} from '../src/catalog-scroll.js';

for (const viewport of [640, 844, 936]) {
  test(`catalog link reveals the first album at viewport height ${viewport}`, () => {
    const rect = {top: 2650, height: viewport * 7};
    const destination = catalogScrollTop(rect, 0, viewport);
    const landed = {top: rect.top - destination, height: rect.height};
    assert.ok(-landed.top >= viewport * .6, 'scene is fully revealed');
    assert.ok(catalogProgress(landed, viewport) * 6 < .002, 'first album stays selected after pixel rounding');
    assert.equal(catalogScrollTop(landed, destination, viewport), destination, 'repeat click stays at the same album');
    for (let i = 1; i < 7; i++) {
      const top = catalogScrollTop(landed, destination, viewport, i);
      assert.ok(Math.abs(catalogProgress({top: rect.top - top, height: rect.height}, viewport) * 6 - i) < .002);
    }
  });
}

test('fade remains within a shorter sticky range', () => {
  assert.equal(catalogFadeLength(1200, 800), 200);
});
