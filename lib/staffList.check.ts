import assert from 'node:assert/strict';

import { appendRank, candidatesFor, cutOf, moved, patronGroups, ranked, staffOrder, unranked } from './staffList';

assert.equal(cutOf(1), 10);
assert.equal(cutOf(10), 10);
assert.equal(cutOf(11), 20);
assert.equal(cutOf(20), 20);
assert.equal(cutOf(21), 50);
assert.equal(cutOf(50), 50);
assert.equal(cutOf(null), null);

const rows = [
  { rank: 12, name: 'House Daiquiri' },
  { rank: null, name: 'Negroni' },
  { rank: 2, name: 'Martini' },
  { rank: null, name: 'Americano' },
  { rank: 1, name: 'Old Fashioned' },
];
const order = staffOrder(rows);
assert.deepEqual(order.ranked.map((r) => r.name), ['Old Fashioned', 'Martini', 'House Daiquiri']);
assert.deepEqual(order.unranked.map((r) => r.name), ['Americano', 'Negroni']);

const groups = patronGroups(rows);
assert.deepEqual(groups.top10.map((r) => r.name), ['Old Fashioned', 'Martini']);
assert.deepEqual(groups.top50.map((r) => r.name), ['House Daiquiri']);
assert.deepEqual(groups.also.map((r) => r.name), ['Americano', 'Negroni']);

assert.equal(appendRank([]), 1);
assert.equal(appendRank([1, 2, null, 12]), 13);
assert.equal(appendRank([50]), null);

assert.deepEqual(moved(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c']);
assert.deepEqual(moved(['a', 'b', 'c'], 'b', 1), ['a', 'c', 'b']);
assert.deepEqual(moved(['a', 'b', 'c'], 'a', -1), ['a', 'b', 'c']);
assert.deepEqual(moved(['a', 'b', 'c'], 'c', 1), ['a', 'b', 'c']);
assert.deepEqual(moved(['a', 'b'], 'x', 1), ['a', 'b']);

assert.deepEqual(ranked(['a'], 'b'), ['a', 'b']);
assert.deepEqual(ranked(['a'], 'a'), ['a']);
const full = Array.from({ length: 50 }, (_, i) => `d${i}`);
assert.equal(ranked(full, 'x'), null);
assert.deepEqual(unranked(['a', 'b', 'c'], 'b'), ['a', 'c']);

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
