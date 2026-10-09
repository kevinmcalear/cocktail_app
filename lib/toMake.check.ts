import assert from 'node:assert/strict';

import { readyFirst, shelfTag } from './toMake';

const canMake = new Set(['sour']);
const oneAway = [
  { bottles: [{ name: 'Cynar' }], drinks: [{ id: 'signal' }] },
  { bottles: [{ name: 'Fino' }, { name: 'Tonic' }], drinks: [{ id: 'tide' }] },
];

// --- the shelf says ready, what to buy, or nothing ---
assert.equal(shelfTag('sour', canMake, oneAway), 'Ready');
assert.equal(shelfTag('signal', canMake, oneAway), 'Need Cynar');
assert.equal(shelfTag('tide', canMake, oneAway), 'Need Fino and Tonic');
assert.equal(shelfTag('martini', canMake, oneAway), undefined);
assert.equal(shelfTag(null, canMake, oneAway), undefined);

// --- ready first, then close, then the rest, each keeping its saved order ---
const ids = ['martini', 'signal', 'sour', 'tide', 'flip'];
assert.deepEqual(readyFirst(ids, (id) => shelfTag(id, canMake, oneAway)), ['sour', 'signal', 'tide', 'martini', 'flip']);
assert.deepEqual(readyFirst([], () => undefined), []);
