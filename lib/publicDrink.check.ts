// Checks for lib/publicDrink.ts (the signed-out drink page's words). Run: npm run test:unit
import assert from 'node:assert/strict';

import { ancestorCaption, createdByLine, drinkKicker, makerLabel, whereCaption } from './publicDrink';

assert.equal(drinkKicker({ origin: 'Modern Classic', originYear: 2005, riffOfId: 'x' }, null), 'Modern classic · 2005');
assert.equal(drinkKicker({ origin: 'Classic', originYear: null, riffOfId: null }, 'Little Rye'), 'Classic', 'a classic is a classic wherever it is poured');
assert.equal(drinkKicker({ origin: 'Original', originYear: 2025, riffOfId: null }, 'Pale Moth'), 'Pale Moth original · 2025');
assert.equal(drinkKicker({ origin: 'Varient', originYear: null, riffOfId: 'm' }, 'Little Rye'), 'Little Rye riff');
assert.equal(drinkKicker({ origin: null, originYear: null, riffOfId: null }, null), 'Original');

const sam = { display_name: 'Sam Ross' };
assert.equal(createdByLine(sam, { name: 'Milk & Honey', place: 'New York' }, 'verified'), 'Created by Sam Ross at Milk & Honey, New York · Verified');
assert.equal(createdByLine(null, { name: 'Pale Moth', place: 'Collingwood' }, 'suggested'), 'Created at Pale Moth, Collingwood · Suggested');
assert.equal(createdByLine(sam, null, null), 'Created by Sam Ross');
assert.equal(createdByLine(null, null, 'verified'), null);

assert.equal(makerLabel({ kind: 'person', handle: 'juniper.jo', display_name: 'Jo' }), '@juniper.jo');
assert.equal(makerLabel({ kind: 'bar', handle: 'littlerye', display_name: 'Little Rye' }), 'Little Rye');
assert.equal(makerLabel(null), null);

assert.equal(ancestorCaption({ origin: 'Classic', originYear: 1870 }, null), 'Classic');
assert.equal(ancestorCaption({ origin: 'Original', originYear: 2000 }, 'Milk & Honey'), 'Milk & Honey, 2000');
assert.equal(ancestorCaption({ origin: null, originYear: null }, null), null);

const rows = [
  { venue_profile_id: 'a', score: 9.1, rankers: 146 },
  { venue_profile_id: 'b', score: 8.9, rankers: 203 },
  { venue_profile_id: 'c', score: 8.6, rankers: 88 },
];
assert.equal(whereCaption(rows, 'Penicillin', 'Melbourne', 'a'), '#1 of 3 Penicillins near Melbourne · 437 ranked');
assert.equal(whereCaption(rows, 'Penicillin', 'Melbourne', null), '3 Penicillins near Melbourne · 437 ranked');
assert.equal(whereCaption(rows.slice(0, 1), 'Martini', null, 'z'), '1 Martini · 146 ranked');
assert.equal(whereCaption([], 'Martini', 'Melbourne', null), null);

console.log('publicDrink checks passed');
