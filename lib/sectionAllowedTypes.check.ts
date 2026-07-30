import assert from 'node:assert/strict';
import {
  allowedTypesLabel,
  createTypeFromFilter,
  isSectionDrinkItem,
  itemAllowedInSection,
  sectionCommandFilter,
} from './sectionAllowedTypes';

assert.equal(sectionCommandFilter(['beer']), 'Beer');
assert.equal(sectionCommandFilter(['cocktail', 'wine']), 'All');
assert.equal(itemAllowedInSection({ id: 'beer-1', category: 'Beer' }, ['beer']), true);
assert.equal(itemAllowedInSection({ id: 'x', category: 'Cocktail' }, ['beer']), false);
assert.equal(allowedTypesLabel(['wine']), 'Wine only');
assert.equal(createTypeFromFilter('Beer'), 'beer');
assert.equal(createTypeFromFilter('All', ['Wine']), 'wine');
assert.equal(isSectionDrinkItem({ id: 'abc', category: 'Cocktail' }), true);
assert.equal(isSectionDrinkItem({ id: 'menu-1', category: 'Menu' }), false);

console.log('sectionAllowedTypes.check.ts: ok');
