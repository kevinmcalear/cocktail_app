// Checks for lib/allergens.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { ALLERGENS, allergenLabel, checkedLine, containsLine, listAllergens, viaLine, type DrinkAllergens } from './allergens';

assert.equal(ALLERGENS.length, 14, 'the 14 regulated allergens');
assert.equal(new Set(ALLERGENS.map((a) => a.key)).size, 14);
assert.equal(allergenLabel('gluten'), 'Cereals containing gluten');
assert.equal(allergenLabel('unknown'), 'unknown', 'an unknown key is shown as itself, never dropped');

assert.equal(listAllergens([]), '');
assert.equal(listAllergens(['eggs']), 'eggs');
assert.equal(listAllergens(['eggs', 'sulphites']), 'eggs and sulphites');
assert.equal(listAllergens(['milk', 'eggs', 'sulphites']), 'milk, eggs and sulphites');

const clover: DrinkAllergens = {
  allergens: [
    { allergen: 'eggs', via: [['Egg white']] },
    { allergen: 'sulphites', via: [['Dolin Dry vermouth'], ['Raspberry syrup', 'Red wine vinegar']] },
  ],
  unchecked: 0,
  lines: 5,
};
assert.equal(containsLine(clover), 'Contains eggs and sulphites.');
assert.equal(containsLine({ ...clover, unchecked: 1 }), 'Contains eggs and sulphites. 1 ingredient not checked yet.');
assert.equal(containsLine({ allergens: [], unchecked: 2, lines: 3 }), 'No allergens declared. 2 ingredients not checked yet.');
assert.equal(containsLine({ allergens: [], unchecked: 0, lines: 3 }), 'No allergens declared.');
assert.equal(containsLine({ allergens: [], unchecked: 0, lines: 0 }), 'No spec yet, so nothing to declare.');
assert.equal(containsLine(null), 'No spec yet, so nothing to declare.');

assert.equal(viaLine(['Raspberry syrup', 'Egg white']), 'via Raspberry syrup, in Egg white');
assert.equal(viaLine(['Dolin Dry vermouth']), 'via Dolin Dry vermouth');
assert.equal(viaLine([]), '', 'a fully masked path says nothing');

const now = new Date('2026-09-29T12:00:00Z');
assert.equal(checkedLine(null, now), 'Not checked yet');
assert.equal(checkedLine('2026-09-24T10:00:00Z', now), 'Checked 24 Sept');
assert.equal(checkedLine('2025-12-24T10:00:00Z', now), 'Checked 24 Dec 2025', 'another year says so');

console.log('allergens ok');
