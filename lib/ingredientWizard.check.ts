import assert from 'node:assert/strict';

import { guessRole, ingredientSteps, INGREDIENT_COPY, kindGuesses, suggestedAbv } from './ingredientWizard';

// A bottle has a maker and a strength; a house prep a recipe; something else neither.
assert.deepEqual(ingredientSteps('product'), ['name', 'what', 'kind', 'maker', 'strength', 'notes', 'review']);
assert.deepEqual(ingredientSteps('prep'), ['name', 'what', 'kind', 'recipe', 'strength', 'notes', 'review']);
assert.deepEqual(ingredientSteps('other'), ['name', 'what', 'kind', 'notes', 'review']);
assert.deepEqual(ingredientSteps(null), ingredientSteps('other'));
for (const s of ingredientSteps('product')) assert.ok(INGREDIENT_COPY[s].title);

// What it is, from the name and maker.
assert.equal(guessRole('House Grenadine Syrup', ''), 'prep');
assert.equal(guessRole('Banana-Infused Bourbon', 'Michter’s'), 'prep', 'an infusion is a prep even with a maker');
assert.equal(guessRole('Tanqueray No. Ten', 'Tanqueray'), 'product');
assert.equal(guessRole('Blood Orange Juice', ''), 'other');
assert.equal(guessRole('Kevin’s Thing', ''), null);
assert.equal(guessRole('Pistachio Orgeat', ''), 'prep', 'house syrups by name');

// Kinds: core names inside it, longest first, never itself.
const core = [
  { id: 'syrup', name: 'Syrup' },
  { id: 'demerara', name: 'Demerara Syrup' },
  { id: 'simple', name: 'Simple Syrup' },
  { id: 'gin', name: 'Gin' },
];
assert.deepEqual(kindGuesses('Rich Demerara Syrup', core).map((c) => c.id), ['demerara', 'syrup']);
assert.deepEqual(kindGuesses('Navy Strength Gin', core).map((c) => c.id), ['gin']);
assert.deepEqual(kindGuesses('Ginger Beer', core).map((c) => c.id), [], 'whole words only');
assert.deepEqual(kindGuesses('Simple Syrup', core).map((c) => c.id), ['syrup'], 'not itself');
const nuts = [{ id: 'pistachio', name: 'Pistachio' }, { id: 'orgeat', name: 'Orgeat' }];
assert.deepEqual(kindGuesses('Pistachio Orgeat', nuts).map((c) => c.id), ['orgeat', 'pistachio'], 'what its name ends with first');
assert.deepEqual(kindGuesses('House Grenadine Syrup', [{ id: 'syrup', name: 'Syrup' }, { id: 'grenadine', name: 'Grenadine' }]).map((c) => c.id), ['grenadine', 'syrup'], 'specific before broad');

// Strength from the taste rules.
assert.equal(suggestedAbv('Tanqueray', 'London Dry Gin') !== null, true);
assert.equal(suggestedAbv('Sweet Vermouth', null), 16);
assert.equal(suggestedAbv('Simple Syrup', null), null);

console.log('ingredient wizard: ok');
