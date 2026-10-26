import assert from 'node:assert/strict';
import { withoutSelfRecipeRefs } from './ingredientHandoff';

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
