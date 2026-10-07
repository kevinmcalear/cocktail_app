// Checks for lib/publicDrinks.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import type { SearchItem } from '../types/search';
import { compareSearchItems, matchesQuery, searchCardMeta, withPublicDrinks } from './publicDrinks';

const mine: SearchItem = { id: 'a', name: 'Negroni', category: 'Cocktail' };
const theirs: SearchItem = { id: 'b', name: 'Coconut Negroni', category: 'Cocktail', fromBar: 'Bar Leone' };
const alsoMine: SearchItem = { ...mine, fromBar: 'Bar Leone' };

// Public drinks go after the library, and one already in it isn't listed twice.
assert.deepEqual(withPublicDrinks([mine], [theirs, alsoMine]).map((i) => i.id), ['a', 'b']);
const library = [mine];
assert.equal(withPublicDrinks(library, []), library);

// Matches on the name, an ingredient or the credited bar.
assert.ok(matchesQuery(theirs, 'coconut'));
assert.ok(matchesQuery(theirs, 'leone'));
assert.ok(!matchesQuery(mine, 'leone'));
assert.ok(
  matchesQuery({ id: 'c', name: 'Paper Plane', recipes: [{ ingredient: { name: 'Aperol' } }] }, 'aperol')
);

// A bar's drink shows who it's credited to and when it was on the menu.
assert.equal(searchCardMeta({ ...theirs, menuRun: 'Past · Mar 2024 to Jan 2025' }), 'Bar Leone · Past · Mar 2024 to Jan 2025');
assert.equal(searchCardMeta(theirs), 'Bar Leone');
assert.equal(searchCardMeta(mine), undefined);

// Drinks on a menu now come first, past menus last, names in between and within.
const order = [
  { id: 'p', name: 'Alpha', menuOrder: 2 },
  { id: 'u', name: 'Zulu', menuOrder: 1 },
  { id: 'n', name: 'Mike' },
  { id: 'c', name: 'Yankee', menuOrder: 0 },
].sort(compareSearchItems);
assert.deepEqual(order.map((i) => i.id), ['c', 'n', 'u', 'p']);

console.log('publicDrinks checks passed');
