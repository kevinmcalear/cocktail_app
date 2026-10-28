// Checks for lib/nearName.ts. Run: npm run test:unit
// The database's twin (public.near_score) is checked against this one in
// supabase/tests/near-names.test.mjs.
import assert from 'node:assert/strict';

import { personNearScore, nearAfter, nearest, nearFold, nearReason, nearScore } from './nearName';

// Folded as the database folds: accents off, lower case, one space.
assert.equal(nearFold('  Piña   Colada '), 'pina colada');
assert.equal(nearFold('Rémy Savage'), 'remy savage');
assert.equal(nearFold(null), '');

// Close: Kevin's example and the typos tried on the local drinks.
const close: [string, string][] = [
  ['salty boy', 'Salti Boi'],
  ['salti boi', 'Salty Boy'],
  ['negorni', 'Negroni'],
  ['ramos fiz', 'Ramos Gin Fizz'],
  ['mai tie', 'Mai Tai'],
  ['peeny colada', 'Piña Colada'],
  ['kosmo', 'Cosmo'],
  ['jungel bird', 'Jungle Bird'],
  ['boulevardeir', 'Boulevardier'],
  ['chartruse', 'Green Chartreuse'],
  ['lanturn room', 'The Lantern Room'],
  ['corpse reviver 2', 'Corpse Reviver #2'],
];
for (const [typed, name] of close) assert.notEqual(nearScore(typed, name), null, `${typed} → ${name}`);

// Not close.
const far: [string, string][] = [
  ['salty boy', 'Smoke Signal'],
  ['gin', 'Tin Cup'], // a three-letter word keeps its first letter
  ['negroni', 'Margarita'],
  ['', 'Negroni'],
  ['  ', 'Negroni'],
  ['ramos fiz', 'Ramos'], // every typed word has to land somewhere
];
for (const [typed, name] of far) assert.equal(nearScore(typed, name), null, `${typed} ↛ ${name}`);

// Scores: exact words, then a start or a slip (by how many letters), then a sound; the whole-name check last.
assert.equal(nearScore('salty boy', 'Salty Boy'), 0);
assert.equal(nearScore('salt', 'Salty Boy'), 1);
assert.equal(nearScore('salti boy', 'Salty Boy'), 1);
assert.equal(nearScore('salty boy', 'Salti Boi'), 2);
// Two slips beat a sound-alike: Salti Boi before Soldier Boy.
assert.equal(nearScore('salty boy', 'Soldier Boy'), 3);
// A short word's sound counts for less: "boy" sounds like "bee" (1 + 4), last of all.
assert.equal(nearScore('salty boy', 'Bee Pollen Salt Rim'), 5);
assert.equal(nearScore('mai tie', 'Mai Tai'), 4);
assert.equal(nearScore('peeny', 'Pina Colada'), 3);
assert.equal(nearScore('jungel bird', 'Jungle Bird'), 12);
// Short words only match as typed; long ones may be two letters off.
assert.equal(nearScore('no', 'Negroni'), null);
assert.equal(nearScore('boulevardeir', 'Boulevardier'), 2);
assert.equal(nearScore('boulevadeir', 'Boulevardier'), null); // three off
// Lengths count characters, as SQL does: an emoji is one, so seven typed allow the whole name one slip.
assert.equal(nearScore('ab🍸cdef', 'ax🍸cdeg'), null);
assert.equal(nearScore('ab🍸cdef', 'ax🍸cdef'), 11);
// Too long to compare letter by letter is simply not close.
assert.equal(nearScore('x'.repeat(300), 'x'.repeat(299)), null);

// A person's short first name, with their last name: Matt and Mat find Mathew Resler, a slip in the last name too; Mark doesn't.
assert.equal(nearScore('matt resler', 'Mathew Resler'), null);
assert.equal(personNearScore('matt resler', 'Mathew Resler'), 1);
assert.equal(personNearScore('Matt Reisler', 'Mathew Resler'), 2);
assert.equal(personNearScore('mat resler', 'Mathew Resler'), 1);
assert.equal(personNearScore('mark resler', 'Mathew Resler'), null);
assert.equal(personNearScore('matt', 'Mathew Resler'), null);

// Why it's close: the loosest part that matched.
assert.equal(nearReason('salty boy', 'Salty Boy'), 'same');
assert.equal(nearReason('salt', 'Salty Boy'), 'start');
assert.equal(nearReason('salty boy', 'Salti Boi'), 'slip');
assert.equal(nearReason('peeny colada', 'Pina Colada'), 'sound');
assert.equal(nearReason('jungel bird', 'Jungle Bird'), 'whole');
assert.equal(nearReason('salty boy', 'Smoke Signal'), null);

// nearest: closest first, then the shorter name, and only close ones.
// Salty Dog is two letters off the whole name: last, as the board's "Also close".
const drinks = [{ name: 'Salty Dog' }, { name: 'Salti Boi' }, { name: 'Smoke Signal' }, { name: 'Salty Boy Sour' }];
assert.deepEqual(nearest('salty boy', drinks, (d) => d.name).map((d) => d.name), ['Salty Boy Sour', 'Salti Boi', 'Salty Dog']);
assert.deepEqual(nearest('salty boy', drinks, (d) => d.name, 1).map((d) => d.name), ['Salty Boy Sour']);
assert.deepEqual(nearest('', drinks, (d) => d.name), []);

// nearAfter: the close names a search didn't already show (a picker's "Did you mean").
assert.deepEqual(nearAfter('salty boy', drinks, [drinks[3]], (d) => d.name).map((d) => d.name), ['Salti Boi', 'Salty Dog']);
assert.deepEqual(nearAfter('  ', drinks, [], (d) => d.name), []);

console.log('nearName checks passed');
