import assert from 'node:assert/strict';

import { canMake, type RecipeRow } from './canMake';

const row = (ingredientId: string, genericId: string | null = null, optional = false): RecipeRow => ({
  ingredientId,
  genericId,
  optional,
});

// Negroni calls for brands whose generics are gin, sweet vermouth, Campari.
const drinks = {
  negroni: [row('tanqueray', 'gin'), row('carpano', 'sweet-vermouth'), row('campari')],
  martini: [row('gin'), row('dry-vermouth'), row('olive', null, true)],
  gold_rush: [row('bourbon'), row('lemon'), row('honey-syrup')],
  bees_knees: [row('gin'), row('lemon'), row('honey-syrup')],
  old_pal: [row('rye'), row('dry-vermouth'), row('campari')],
  empty: [],
};
const houseMade = { 'honey-syrup': [row('honey'), row('water')] };

// A generic on the shelf covers a branded row, and optional rows don't block.
let r = canMake({ shelf: ['gin', 'sweet-vermouth', 'dry-vermouth'], drinks, houseMade });
assert.deepEqual(r.canMake, ['martini']);
assert.deepEqual(
  r.oneAway.map((a) => [a.ingredientId, a.drinkIds]),
  [['campari', ['negroni']]]
);

// A brand on the shelf covers a generic row (Beefeater is a gin because some
// row says so), and the fixpoint makes honey syrup from honey and water.
r = canMake({
  shelf: ['tanqueray', 'carpano', 'campari', 'honey', 'water', 'lemon', 'dry-vermouth'],
  drinks,
  houseMade,
});
assert.deepEqual(r.canMake.sort(), ['bees_knees', 'martini', 'negroni']);
assert.ok(r.onHand.has('honey-syrup'));
// Gold Rush and Old Pal are each one bottle away; bourbon and rye.
assert.deepEqual(
  r.oneAway.map((a) => a.ingredientId),
  ['bourbon', 'rye']
);

// Without water, the syrup can't be made. What to buy is the water, not the
// syrup, so Bee's Knees is one bottle (water) away.
r = canMake({ shelf: ['gin', 'lemon', 'honey'], drinks, houseMade });
assert.deepEqual(r.canMake, []);
assert.ok(r.oneAway.some((a) => a.ingredientId === 'water' && a.drinkIds.includes('bees_knees')));
assert.ok(r.oneAway.some((a) => a.ingredientId === 'dry-vermouth' && a.drinkIds.includes('martini')));
assert.ok(!r.oneAway.some((a) => a.ingredientId === 'honey-syrup'));

// Missing both honey and water means two bottles: not one away.
r = canMake({ shelf: ['gin', 'lemon'], drinks, houseMade });
assert.ok(!r.oneAway.some((a) => a.drinkIds.includes('bees_knees')));

// A recipe cycle stops at the depth bound instead of looping.
r = canMake({ shelf: [], drinks: {}, houseMade: { a: [row('b')], b: [row('a')] } });
assert.equal(r.onHand.size, 0);

console.log('canMake: ok');
