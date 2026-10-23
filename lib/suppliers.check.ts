import assert from 'node:assert/strict';

import { byRegion, pickSuppliers, regionHeading, suggestSuppliers, suppliesLine, venueRegions, withoutSupplier, type VenueIngredient } from './suppliers';

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

// The pick under a line: the supplier whose page lists the maker here, then whoever brings the same kind, then the most.
const sup = (id: string, items: number, more: { order_by?: string; pageId?: string } = {}) => ({ id, name: id, order_by: more.order_by ?? null, items, pageId: more.pageId ?? null });
const pommeau = { id: 'pommeau', makerId: 'dupont', kindId: 'apple-brandy' };
const bought = [
  { id: 'calvados', name: 'Calvados', makerId: 'boulard', kindId: 'apple-brandy', supplierId: 'Cellar & Co' },
  { id: 'fino', name: 'Fino sherry', makerId: 'tio', kindId: 'sherry', supplierId: 'Bluestone' },
];
const byKind = pickSuppliers(pommeau, [sup('Bluestone', 42, { order_by: 'Thu' }), sup('Cellar & Co', 12, { order_by: 'Tue' })], bought, new Set(), 'In Victoria');
assert.deepEqual(byKind.choices.map((c) => c.sub), ['Brings your Calvados and 11 more · orders by Tue', 'Brings 42 of your bottles · orders by Thu']);
assert.equal(byKind.suggested, 'Cellar & Co');
assert.equal(byKind.why, 'Cellar & Co brings your Calvados');
const byPage = pickSuppliers(pommeau, [sup('Bluestone', 42, { pageId: 'p-blue' }), sup('Cellar & Co', 12)], bought, new Set(['p-blue']), 'In Victoria');
assert.equal(byPage.suggested, 'Bluestone');
assert.equal(byPage.why, 'Bluestone’s page lists it in Victoria');
const none = pickSuppliers({ id: 'x', makerId: null, kindId: null }, [sup('A', 1), sup('B', 0)], bought, new Set(), null);
assert.deepEqual(none.choices.map((c) => [c.id, c.sub]), [['A', 'Brings one of your bottles'], ['B', 'Nothing of yours yet']]);
assert.equal(none.suggested, null);

console.log('suppliers: ok');
