import assert from 'node:assert/strict';

import { drinkSeed, seedDrink } from './drinkSeeds';

// A row with one URL becomes a hero picture; a row with links keeps them.
seedDrink({ id: 'a', name: 'Martini', imageUrl: 'https://x/a.jpg' });
assert.deepEqual(drinkSeed('a'), { id: 'a', name: 'Martini', item_images: [{ angle: 'hero', images: { url: 'https://x/a.jpg' } }] });
const links = [{ angle: 'hero' as const, sort_order: 1, images: { url: 'https://x/b.jpg' } }];
seedDrink({ id: 'b', name: 'Negroni', imageUrl: 'ignored', item_images: links });
assert.deepEqual(drinkSeed('b')?.item_images, links);
seedDrink({ id: 'c', name: 'Daiquiri' });
assert.deepEqual(drinkSeed('c')?.item_images, [], 'no picture: the page draws its sketch');
assert.equal(drinkSeed('nope'), undefined);
assert.equal(drinkSeed(null), undefined);

// Only the last 50 are kept, and pressing one again keeps it longest.
seedDrink({ id: 'a', name: 'Martini' });
for (let i = 0; i < 49; i++) seedDrink({ id: `n${i}`, name: `n${i}` });
assert.equal(drinkSeed('b'), undefined, 'oldest dropped');
assert.ok(drinkSeed('a'), 'pressed again, kept');

console.log('drinkSeeds: ok');
