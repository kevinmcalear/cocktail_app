// Checks for lib/menuEditions.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { editionMenuDrinks, menuDate, sortEditions } from './menuEditions';

assert.equal(menuDate({ year: 2023, month: 5 }), 'May 2023');
assert.equal(menuDate({ year: 2019, month: null }), '2019');
assert.equal(menuDate({ year: 2019, month: 12 }), 'December 2019');

// Newest first; a year-only menu after that year's dated ones.
assert.deepEqual(
  sortEditions([
    { name: 'B', year: 2022, month: null },
    { name: 'A', year: 2022, month: 3 },
    { name: 'C', year: 2024, month: 1 },
    { name: 'D', year: 2022, month: 11 },
  ]).map((e) => e.name),
  ['C', 'D', 'A', 'B']
);

// The edition's order wins; a drink the reader couldn't load keeps its name.
const full = { id: 'b', name: 'Bee', kind: 'cocktail' as const, line: 'Gin, honey', price: null, imageUrl: 'x', isSketch: false, glass: null };
const set = editionMenuDrinks([{ id: 'a', name: 'Ay' }, { id: 'b', name: 'Bee' }], [full]);
assert.deepEqual(set.map((d) => d.id), ['a', 'b']);
assert.equal(set[0].name, 'Ay');
assert.equal(set[0].line, '');
assert.equal(set[1], full);

console.log('menu editions checks passed');
