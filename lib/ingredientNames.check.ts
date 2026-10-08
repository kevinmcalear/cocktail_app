import assert from 'node:assert/strict';

import { existingIngredientId, ingredientKey, nearIngredient, sameIngredient, searchIngredients } from './ingredientNames';

// The same keys public.ingredient_key() gives (checked against Postgres in supabase/tests/one-of-each-ingredient.test.mjs).
assert.equal(ingredientKey('Simple Syrup, 1:1'), 'simple syrup 1:1');
assert.equal(ingredientKey('Crème de Cassis'), 'creme de cassis');
assert.equal(ingredientKey('Peychaud’s Bitters'), 'peychauds bitters');
assert.equal(ingredientKey('Rock & Rye'), 'rock and rye');
assert.equal(ingredientKey('Añejo Tequila'), 'anejo tequila');
assert.equal(ingredientKey('Økar Island Bitter'), 'okar island bitter');
assert.equal(ingredientKey('   '), '');
assert.equal(ingredientKey(null), '');

const rows = [
  { id: 'simple', name: 'Simple Syrup' },
  { id: 'rich', name: 'Rich Simple Syrup' },
  { id: 'rasp', name: 'Raspberry' },
  { id: 'rum', name: 'Rum' },
  { id: 'venue', name: 'Simple Syrup', bar_id: 'bar-1' },
  { id: 'oneoff', name: 'Coconut-oolong Demerara Syrup', hide_from_search: true },
  { id: 'sugar', name: 'Sugar' },
];
const aliases = [
  { key: '1:1 sugar syrup', item_id: 'simple' },
  { key: 'sugar syrup', item_id: 'simple' },
  { key: '2:1 sugar syrup', item_id: 'rich' },
];

// Typing another spelling, or an alias, finds the one shared row (never a venue's own).
assert.equal(sameIngredient('simple syrup', rows, aliases)?.id, 'simple');
assert.equal(sameIngredient('Simple-Syrup', rows, aliases)?.id, 'simple');
assert.equal(sameIngredient('1:1 Sugar Syrup', rows, aliases)?.id, 'simple');
assert.equal(sameIngredient('2:1 sugar syrup', rows, aliases)?.id, 'rich');
assert.equal(sameIngredient('Honey Syrup', rows, aliases), null);

// Misspellings and plurals get a "Did you mean…?"; short names don't.
assert.equal(nearIngredient('Raspberries', rows)?.id, 'rasp');
assert.equal(nearIngredient('Rasberry', rows)?.id, 'rasp');
assert.equal(nearIngredient('Simple Syurp', rows)?.id, 'simple');
assert.equal(nearIngredient('Gum', rows), null, 'short names need an exact match');
assert.equal(nearIngredient('Simple Syrup', rows), null, 'an exact match is not a near one');
assert.equal(nearIngredient('Honey Syrup', rows), null);

// Search: the one it is first, then core, start before contain; one-offs only in full.
const core = new Set(['simple', 'rich', 'sugar']);
assert.deepEqual(searchIngredients('sugar syrup', rows, { aliases, coreIds: core }).map((r) => r.id)[0], 'simple');
assert.deepEqual(searchIngredients('sugar', rows, { aliases, coreIds: core }).map((r) => r.id), ['sugar', 'simple'], 'an alias that starts with it counts');
assert.ok(!searchIngredients('syrup', rows, { aliases, coreIds: core }).some((r) => r.id === 'oneoff'), 'one-offs stay out of partial search');
assert.equal(searchIngredients('coconut oolong demerara syrup', rows, { aliases })[0]?.id, 'oneoff');

// The refusal's hint is the ingredient to use.
assert.equal(existingIngredientId({ code: 'P0001', hint: '3f2b1c4e-1111-4222-8333-944455556666' }), '3f2b1c4e-1111-4222-8333-944455556666');
assert.equal(existingIngredientId({ code: '23505', hint: null }), null);
assert.equal(existingIngredientId(null), null);

console.log('ingredientNames checks passed');
