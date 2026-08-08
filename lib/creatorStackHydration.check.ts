import assert from 'node:assert/strict';
import { shouldKeepCreatorStack } from './creatorStackHydration';

const cocktail = { id: 'c1', type: 'published_drink' };
const ingredient = { id: 'i1', type: 'published_ingredient' };
const menu = { id: 'm1', type: 'menu_draft' };

assert.equal(shouldKeepCreatorStack('published_drink', 'c1', []), false);
assert.equal(shouldKeepCreatorStack('published_drink', 'c1', [cocktail]), true);
assert.equal(
  shouldKeepCreatorStack('published_drink', 'c1', [cocktail, ingredient]),
  true
);
assert.equal(
  shouldKeepCreatorStack('published_ingredient', 'i1', [cocktail, ingredient]),
  true
);
assert.equal(
  shouldKeepCreatorStack('menu_draft', 'm1', [menu, cocktail]),
  true
);
assert.equal(
  shouldKeepCreatorStack('published_drink', 'other', [cocktail, ingredient]),
  false
);

console.log('creatorStackHydration.check: ok');
