import assert from 'node:assert/strict';

import type { PublishedDrinkPage } from '@/hooks/usePublished';

import { visitorDrink } from './visitorDrink';

const page = (over: Partial<PublishedDrinkPage['drink']> = {}, rest: Partial<PublishedDrinkPage> = {}): PublishedDrinkPage => ({
  drink: {
    id: 'd1',
    name: 'Rye and Fig Old Fashioned',
    itemType: 'cocktail',
    description: 'Rich and dry.',
    barId: 'bar1',
    glasswareId: 'g1',
    iceId: null,
    familyId: null,
    origin: null,
    abv: null,
    publishMode: 'description',
    publishedAt: null,
    imageUrl: 'https://x/d1.jpg',
    imageIsGenerated: true,
    creatorProfileId: null,
    originBarProfileId: null,
    originYear: null,
    riffOfId: null,
    creditStatus: null,
    ...over,
  },
  bar: { name: 'Little Rye', handle: 'little-rye' },
  glass: null,
  ice: null,
  family: null,
  recipes: [],
  names: [{ name: 'Rye whiskey', brand: false }],
  ...rest,
});

// Names only: the lock says the bar keeps it, lists what goes in and links the bar's page.
const named = visitorDrink(page());
assert.equal(named.item.id, 'd1');
assert.equal(named.item.bar_id, 'bar1');
assert.equal(named.item.glassware_id, 'g1');
assert.deepEqual(named.item.item_images, [{ angle: 'hero', is_generated: true, images: { url: 'https://x/d1.jpg' } }]);
assert.deepEqual(named.lock, { bar: { id: 'bar1', handle: 'little-rye', name: 'Little Rye', isClaimed: true, visibility: null }, names: [{ name: 'Rye whiskey', brand: false }] });

// With the spec shared: no lock, the published lines.
const recipes = [{ id: 'r1', amount: 60, unit: 'ml' }] as unknown as PublishedDrinkPage['recipes'];
const shared = visitorDrink(page({ publishMode: 'spec' }, { recipes }));
assert.equal(shared.lock, null);
assert.equal(shared.item.recipes, recipes);

// No picture: the page draws its sketch.
assert.deepEqual(visitorDrink(page({ imageUrl: null })).item.item_images, []);

console.log('visitorDrink: ok');
