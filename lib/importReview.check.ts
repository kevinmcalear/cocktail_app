import assert from 'node:assert/strict';

import { addMade, countWords, nextWaiting, nothingMade, plainTitle, reviewCount, whenWords, type DrinkMark } from './importReview';

// The board's numbers: 18 of 46 checked, 15 approved, 3 skipped.
const marks: DrinkMark[] = [...Array(14).fill('approved'), 'edited', ...Array(3).fill('skipped'), ...Array(28).fill('waiting')];
const c = reviewCount(marks);
assert.deepEqual([c.total, c.checked, c.approved, c.skipped, c.percent], [46, 18, 15, 3, 39]);
assert.equal(countWords(c), '18 of 46 checked · 15 approved · 3 skipped');
assert.equal(countWords(c, 'short'), '18 of 46');
assert.equal(countWords(c, 'checked'), '18 of 46 checked');
assert.equal(countWords(reviewCount(['waiting', 'waiting'])), '0 of 2 checked');
assert.equal(reviewCount([]).percent, 0);

// Next waiting goes on from here, round to the start, and stops when none wait.
assert.equal(nextWaiting(['approved', 'waiting', 'skipped', 'waiting'], 1), 3);
assert.equal(nextWaiting(['waiting', 'approved', 'skipped', 'approved'], 2), 0);
assert.equal(nextWaiting(['waiting', 'approved'], 0), 0);
assert.equal(nextWaiting(['approved', 'skipped'], 0), null);

// Made things add up across approvals, and the inputs stay as they were.
const one = { ...nothingMade(), itemIds: ['d1', 'i1'], drinkIds: ['d1'], summary: { ...nothingMade().summary, drinksNew: 1, ingredients: ['Fig syrup'] } };
const two = { ...nothingMade(), itemIds: ['d2'], drinkIds: ['d2'], warnings: ['w'], summary: { ...nothingMade().summary, drinksNew: 1, noAmounts: 1 } };
const both = addMade(addMade(nothingMade(), one), two);
assert.deepEqual(both.itemIds, ['d1', 'i1', 'd2']);
assert.deepEqual(both.drinkIds, ['d1', 'd2']);
assert.equal(both.summary.drinksNew, 2);
assert.equal(both.summary.noAmounts, 1);
assert.deepEqual(both.summary.ingredients, ['Fig syrup']);
assert.deepEqual(both.warnings, ['w']);
assert.deepEqual(one.drinkIds, ['d1']);
// Plain JSON all the way, for the persisted store.
assert.deepEqual(JSON.parse(JSON.stringify(both)), both);

const now = new Date(2026, 9, 22, 9, 0);
assert.equal(whenWords(new Date(2026, 9, 22, 1, 0).toISOString(), now), 'Today');
assert.equal(whenWords(new Date(2026, 9, 21, 23, 0).toISOString(), now), 'Yesterday');
assert.equal(whenWords(new Date(2026, 9, 18, 12, 0).toISOString(), now), '4 days ago');

assert.equal(plainTitle('Little Rye spec book.pdf'), 'Little Rye spec book');
assert.equal(plainTitle('notes'), 'notes');

console.log('importReview checks passed');
