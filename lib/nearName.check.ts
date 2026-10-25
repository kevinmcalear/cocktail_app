// Checks for lib/nearName.ts. Run: npm run test:unit
// The database's twin (public.near_score) is checked against this one in
// supabase/tests/near-names.test.mjs.
import assert from 'node:assert/strict';

import { nearest, nearFold, nearScore } from './nearName';

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

// Scores: exact words, then starts, then a slip, then a sound; the whole-name check last.
assert.equal(nearScore('salty boy', 'Salty Boy'), 0);
assert.equal(nearScore('salt', 'Salty Boy'), 1);
assert.equal(nearScore('salti boy', 'Salty Boy'), 2);
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

// nearest: closest first, then the shorter name, and only close ones.
// Salty Dog is two letters off the whole name: last, as the board's "Also close".
const drinks = [{ name: 'Salty Dog' }, { name: 'Salti Boi' }, { name: 'Smoke Signal' }, { name: 'Salty Boy Sour' }];
assert.deepEqual(nearest('salty boy', drinks, (d) => d.name).map((d) => d.name), ['Salty Boy Sour', 'Salti Boi', 'Salty Dog']);
assert.deepEqual(nearest('salty boy', drinks, (d) => d.name, 1).map((d) => d.name), ['Salty Boy Sour']);
assert.deepEqual(nearest('', drinks, (d) => d.name), []);

console.log('nearName checks passed');
