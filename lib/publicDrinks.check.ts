// Checks for lib/publicDrinks.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import type { SearchItem } from '../types/search';
import { creditName, matchesQuery, withPublicDrinks } from './publicDrinks';

const names = { bar: 'Bar Leone', person: 'Lorenzo Antinori' };

// The bar wins over the person; a person alone still gets credit; unknown ids get none.
assert.equal(creditName({ origin_bar_profile_id: 'bar', creator_profile_id: 'person' }, names), 'Bar Leone');
assert.equal(creditName({ origin_bar_profile_id: null, creator_profile_id: 'person' }, names), 'Lorenzo Antinori');
assert.equal(creditName({ origin_bar_profile_id: 'gone', creator_profile_id: 'person' }, names), 'Lorenzo Antinori');
assert.equal(creditName({ origin_bar_profile_id: null, creator_profile_id: null }, names), undefined);

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

console.log('publicDrinks checks passed');
