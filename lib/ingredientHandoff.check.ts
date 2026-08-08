import assert from 'node:assert/strict';
import { applyIngredientHandoff, withoutSelfRecipeRefs } from './ingredientHandoff';

const base = [
  { ingredient_id: 'a', name: 'A', amount: '1', unit: 'oz' },
  { ingredient_id: 'draft', name: 'Tea', amount: '', unit: '' },
];

// wrong target → ignore
assert.equal(
  applyIngredientHandoff(base, { id: 'x', name: 'X', targetId: 'parent' }, 'other'),
  null
);

// self id / replacedId → ignore
assert.equal(
  applyIngredientHandoff(base, { id: 'me', name: 'Me', targetId: 'me' }, 'me'),
  null
);
assert.equal(
  applyIngredientHandoff(base, { id: 'pub', name: 'Me', replacedId: 'me', targetId: 'me' }, 'me'),
  null
);

// append for matching parent
assert.deepEqual(
  applyIngredientHandoff(base, { id: 'x', name: 'X', targetId: 'parent' }, 'parent', {
    amount: '',
    unit: '',
  }),
  [...base, { ingredient_id: 'x', name: 'X', amount: '', unit: '' }]
);

// replace draft → published (no duplicate)
assert.deepEqual(
  applyIngredientHandoff(
    base,
    { id: 'pub', name: 'Lapsang', replacedId: 'draft', targetId: 'parent' },
    'parent'
  ),
  [
    { ingredient_id: 'a', name: 'A', amount: '1', unit: 'oz' },
    { ingredient_id: 'pub', name: 'Lapsang', amount: '', unit: '' },
  ]
);

// already present → no-op copy semantics (same contents)
assert.deepEqual(
  applyIngredientHandoff(base, { id: 'a', name: 'A', targetId: 'parent' }, 'parent'),
  base
);

assert.deepEqual(
  withoutSelfRecipeRefs(
    [
      { ingredient_id: 'me', name: 'Me' },
      { ingredient_id: 'other', name: 'Other' },
    ],
    'me'
  ),
  [{ ingredient_id: 'other', name: 'Other' }]
);

console.log('ingredientHandoff.check: ok');
