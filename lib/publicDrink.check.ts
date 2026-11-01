// Checks for lib/publicDrink.ts (the signed-out drink page's words). Run: npm run test:unit
import assert from 'node:assert/strict';

import { ancestorCaption, createdByLine, drinkKicker, ingredientsLine, makerLabel, whereCaption } from './publicDrink';

const g = (name: string) => ({ name, brand: false });
assert.equal(ingredientsLine([g('Scotch'), g('Lemon'), g('Honey Syrup'), g('Scotch'), g('Ginger')]), 'Scotch, lemon, honey syrup, ginger', 'each name once, in order');
assert.equal(ingredientsLine([g('Gin'), { name: 'Green Chartreuse', brand: true }, g('Maraschino Liqueur')]), 'Gin, Green Chartreuse, maraschino liqueur', 'a product keeps its capitals');
assert.equal(ingredientsLine([g('Blended Scotch'), g('Islay Scotch')]), 'Blended Scotch, Islay Scotch', 'a place stays capitalised');
assert.equal(ingredientsLine([]), null);

assert.equal(drinkKicker({ name: 'Penicillin', origin: 'Modern Classic', originYear: 2005, riffOfId: 'x' }, null), 'Modern classic · 2005');
assert.equal(drinkKicker({ name: 'Negroni', origin: 'Classic', originYear: null, riffOfId: null }, 'Little Rye'), 'Classic', 'a classic is a classic wherever it is poured');
assert.equal(drinkKicker({ name: 'Moth', origin: 'Original', originYear: 2025, riffOfId: null }, 'Pale Moth'), 'Pale Moth original · 2025');
assert.equal(drinkKicker({ name: 'Smoky Martini', origin: 'Varient', originYear: null, riffOfId: 'm', riffOf: { name: 'Martini' } }, 'Little Rye'), 'Little Rye riff');
assert.equal(drinkKicker({ name: 'Smoky Martini', origin: 'Varient', originYear: null, riffOfId: 'm', riffOf: null }, 'Little Rye'), 'Little Rye riff', 'a parent nobody can read: a riff, as before');
assert.equal(drinkKicker({ name: 'Smoky Martini', origin: 'Varient', originYear: 2024, riffOfId: 'm' }, 'Little Rye'), '2024', 'no riff or version word until the parent is known');
assert.equal(drinkKicker({ name: 'Gin and Tonic', origin: null, originYear: null, riffOfId: 'g', riffOf: { name: 'Gin & Tonic', aliases: ['Gin and Tonic'] } }, 'Little Rye'), 'Little Rye version');
assert.equal(drinkKicker({ name: 'Moth', origin: null, originYear: null, riffOfId: null }, null), 'Original');
assert.equal(drinkKicker({ origin: 'Varient', originYear: null, riffOfId: 'a', name: 'Americano', riffOf: { name: 'Americano' } }, 'Little Rye'), 'Little Rye version', 'the bar\'s own Americano is not a riff (dec-21)');
assert.equal(drinkKicker({ origin: null, originYear: null, riffOfId: 'a', name: 'Smoky Americano', riffOf: { name: 'Americano' } }, null), 'Riff');

const sam = { display_name: 'Sam Ross' };
assert.equal(createdByLine(sam, { name: 'Milk & Honey', place: 'New York' }, 'verified'), 'Created by Sam Ross at Milk & Honey, New York · Verified');
assert.equal(createdByLine(null, { name: 'Pale Moth', place: 'Collingwood' }, 'suggested'), 'Created at Pale Moth, Collingwood · Suggested');
assert.equal(createdByLine(sam, null, null), 'Created by Sam Ross');
assert.equal(createdByLine(null, null, 'verified'), null);
assert.equal(createdByLine(null, { name: 'The Savoy', place: 'London' }, null, ['Harry Craddock']), 'Created by Harry Craddock at The Savoy, London', 'a maker with no page, by name (tf-063)');
assert.equal(createdByLine(sam, null, null, ['Jo Bloggs']), 'Created by Sam Ross and Jo Bloggs');

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
