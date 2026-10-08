import assert from 'node:assert/strict';

import { arrangeShelf, bottleLine } from './pantry';

const shelf = [
  { id: '1', name: 'Woodford Reserve Double Oaked', kind: 'Bourbon', uses: 5 },
  { id: '2', name: 'Campari', kind: 'Bitter Aperitivo', uses: 2 },
  { id: '3', name: 'Mystery Bottle', kind: null, uses: 0 },
  { id: '4', name: 'Buffalo Trace', kind: 'Bourbon', uses: 2 },
];
const names = (list: typeof shelf) => list.map((b) => b.name);

// Newest keeps the order the shelf came in.
assert.deepEqual(names(arrangeShelf(shelf, 'newest', '')), ['Woodford Reserve Double Oaked', 'Campari', 'Mystery Bottle', 'Buffalo Trace']);
assert.deepEqual(names(arrangeShelf(shelf, 'az', '')), ['Buffalo Trace', 'Campari', 'Mystery Bottle', 'Woodford Reserve Double Oaked']);
// By style: styles A to Z, bottles in a style A to Z, no style last.
assert.deepEqual(names(arrangeShelf(shelf, 'style', '')), ['Campari', 'Buffalo Trace', 'Woodford Reserve Double Oaked', 'Mystery Bottle']);
// Most used: most drinks first, ties A to Z. Unused: only bottles nothing uses.
assert.deepEqual(names(arrangeShelf(shelf, 'used', '')), ['Woodford Reserve Double Oaked', 'Buffalo Trace', 'Campari', 'Mystery Bottle']);
assert.deepEqual(names(arrangeShelf(shelf, 'unused', '')), ['Mystery Bottle']);
// Search matches the name or the style, ignoring case and spaces around it.
assert.deepEqual(names(arrangeShelf(shelf, 'az', ' bourbon ')), ['Buffalo Trace', 'Woodford Reserve Double Oaked']);
assert.deepEqual(names(arrangeShelf(shelf, 'newest', 'camp')), ['Campari']);
// It never sorts the caller's array in place.
assert.equal(shelf[0].name, 'Woodford Reserve Double Oaked');

assert.equal(bottleLine({ kind: 'Bourbon', maker: null, abv: 45.2 }), 'Bourbon · 45.2%');
assert.equal(bottleLine({ kind: 'Fernet', maker: 'Fratelli Branca', abv: 30 }), 'Fratelli Branca · 30%');
assert.equal(bottleLine({ kind: null, maker: null, abv: null }), '');

console.log('pantry.check: ok');
