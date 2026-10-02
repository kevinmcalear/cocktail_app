import assert from 'node:assert/strict';

import { bandOf, candidatesFor, nextRank, patronGroups, TOP_10, TOP_40 } from './offMenu';

assert.equal(bandOf(1), 'top10');
assert.equal(bandOf(TOP_10), 'top10');
assert.equal(bandOf(TOP_10 + 1), 'top40');
assert.equal(bandOf(TOP_40), 'top40');
assert.equal(bandOf(null), 'also');

assert.equal(nextRank([1, 2], 'top10'), 3);
assert.equal(nextRank([11], 'top10'), 1);
assert.equal(nextRank([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'top10'), null);
assert.equal(nextRank([11, 12], 'top40'), 13);
assert.equal(nextRank([], 'top40'), 11);

const groups = patronGroups([
  { rank: 12, name: 'House Daiquiri' },
  { rank: null, name: 'Negroni' },
  { rank: 2, name: 'Martini' },
  { rank: null, name: 'Americano' },
  { rank: 1, name: 'Old Fashioned' },
]);
assert.deepEqual(groups.top10.map((r) => r.name), ['Old Fashioned', 'Martini']);
assert.deepEqual(groups.top40.map((r) => r.name), ['House Daiquiri']);
assert.deepEqual(groups.also.map((r) => r.name), ['Americano', 'Negroni']);

const riffs = [{ id: 'house', name: 'House Negroni', classicName: 'Negroni' }];
const classics = [
  { id: 'neg', name: 'Negroni' },
  { id: 'mar', name: 'Martini' },
];
assert.deepEqual(candidatesFor(riffs, classics, '', new Set()), []);
assert.deepEqual(
  candidatesFor(riffs, classics, 'neg', new Set()).map((c) => c.id),
  ['house', 'neg'],
);
assert.deepEqual(
  candidatesFor(riffs, classics, 'neg', new Set(['house'])).map((c) => c.id),
  ['neg'],
);
assert.equal(candidatesFor(
  Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, name: `Riff ${i}`, classicName: 'Negroni' })),
  [],
  'riff',
  new Set(),
).length, 8);
