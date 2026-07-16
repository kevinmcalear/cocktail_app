import assert from 'node:assert/strict';
import {
  EMPTY_ATTRS,
  allowedAttrKeys,
  appliedAttrPills,
  pruneAttrs,
} from './commandFilterAttrs';

assert.deepEqual(allowedAttrKeys('Wine'), ['wineStyle']);
assert.ok(!allowedAttrKeys('Wine').includes('beerStyle'));
assert.ok(!allowedAttrKeys('Wine').includes('ice'));
assert.deepEqual(allowedAttrKeys('Beer'), ['beerStyle']);
assert.ok(allowedAttrKeys('Cocktails').includes('method'));
assert.ok(!allowedAttrKeys('Cocktails').includes('beerStyle'));
assert.deepEqual(allowedAttrKeys('Menus'), []);
assert.ok(allowedAttrKeys('All').includes('spirit'));

const dirty = {
  ...EMPTY_ATTRS,
  wineStyle: ['w1'],
  beerStyle: ['b1'],
  method: ['m1'],
};
assert.deepEqual(pruneAttrs(dirty, 'Wine'), {
  ...EMPTY_ATTRS,
  wineStyle: ['w1'],
});
assert.deepEqual(pruneAttrs(dirty, 'Menus'), EMPTY_ATTRS);

const pills = appliedAttrPills(
  { ...EMPTY_ATTRS, method: ['m1'], wineStyle: ['w1'] },
  (key, id) => (key === 'method' && id === 'm1' ? 'Shake' : key === 'wineStyle' ? 'Red' : undefined)
);
assert.equal(pills.length, 2);
assert.equal(pills[0].label, 'Shake');

console.log('commandFilterAttrs.check.ts: ok');
