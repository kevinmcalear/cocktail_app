import assert from 'node:assert/strict';

import { byRegion, regionHeading, suggestSuppliers, suppliesLine, venueRegions, withoutSupplier, type VenueIngredient } from './suppliers';

assert.equal(suppliesLine(['glassware', 'bottles']), 'Supplies bottles and glassware');
assert.equal(suppliesLine(['equipment']), 'Supplies bar equipment');
assert.equal(suppliesLine([]), 'Supplier');
assert.equal(suppliesLine(['napkins']), 'Supplier');

assert.equal(regionHeading('AU-VIC'), 'In Victoria');
assert.equal(regionHeading('AU-ACT'), 'In the ACT');
assert.equal(regionHeading('AU'), 'Across Australia');
assert.equal(regionHeading('US-NY'), 'In US-NY');

const groups = byRegion([
  { region: 'AU', name: 'a' },
  { region: 'AU-VIC', name: 'b' },
  { region: 'AU-NSW', name: 'c' },
  { region: 'AU-VIC', name: 'd' },
]);
assert.deepEqual(
  groups.map((g) => [g.heading, g.lines.map((l) => l.name)]),
  [
    ['In New South Wales', ['c']],
    ['In Victoria', ['b', 'd']],
    ['Across Australia', ['a']],
  ]
);

// A venue's regions, from its region as typed.
assert.deepEqual(venueRegions('AU', 'VIC'), ['AU-VIC', 'AU']);
assert.deepEqual(venueRegions('AU', 'New South Wales'), ['AU-NSW', 'AU']);
assert.deepEqual(venueRegions('AU', 'Australian Capital Territory'), ['AU-ACT', 'AU']);
assert.deepEqual(venueRegions('AU', 'Northern Territory'), ['AU-NT', 'AU']);
assert.deepEqual(venueRegions('AU', 'act'), ['AU-ACT', 'AU']);
assert.deepEqual(venueRegions('US', 'NY'), ['US-NY', 'US']);
assert.deepEqual(venueRegions('AU', null), ['AU']);
assert.deepEqual(venueRegions(null, 'VIC'), []);

// Suggestions: suppliers carrying the venue's makers where it is, most bottles first, none it has.
const page = (id: string) => ({ id, display_name: id });
const bottles = [
  { itemId: 'gin', makerId: 'saltbush' },
  { itemId: 'vodka', makerId: 'saltbush' },
  { itemId: 'amaro', makerId: 'wattle' },
];
const lines = [
  { makerId: 'saltbush', region: 'AU-VIC', page: page('bluestone') },
  { makerId: 'wattle', region: 'AU', page: page('bluestone') },
  { makerId: 'wattle', region: 'AU-VIC', page: page('harbour') },
  { makerId: 'saltbush', region: 'AU-NSW', page: page('sydneyco') },
  { makerId: 'wattle', region: 'AU', page: page('mine') },
];
assert.deepEqual(
  suggestSuppliers(bottles, lines, ['AU-VIC', 'AU'], new Set(['mine'])).map((s) => [s.page.id, s.bottles]),
  [['bluestone', 3], ['harbour', 1]]
);

// No supplier yet: used, bought (not a house prep, not water), no supplier; A to Z.
const ing = (name: string, more: Partial<VenueIngredient> = {}): VenueIngredient => ({ id: name, name, type: 'ingredient', role: 'product', makerId: null, supplierId: null, used: true, ...more });
assert.deepEqual(
  withoutSupplier([
    ing('Cynar'),
    ing('Campari'),
    ing('Gin', { supplierId: 's1' }),
    ing('Honey syrup', { role: 'prep' }),
    ing('Filtered water', { role: 'generic' }),
    ing('Lime', { role: 'generic' }),
    ing('Bought, not used', { used: false }),
    ing('A house drink', { type: 'cocktail', role: null }),
  ]).map((i) => i.name),
  ['Campari', 'Cynar', 'Lime']
);

console.log('suppliers: ok');
