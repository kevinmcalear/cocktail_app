import assert from 'node:assert/strict';

import {
  drawingKey, GLASS_TYPE_LABEL, GLASS_TYPES, glassCapacity, glassPromptKey, glassTitle, hasGlass, isVenueGlassName,
} from './glassware';

assert.equal(glassTitle({ name: '  ', glass: 'nick' }), 'Nick & Nora');
assert.equal(glassTitle({ name: 'Leopold coupe', glass: 'coupe' }), 'Leopold coupe');
for (const g of GLASS_TYPES) assert.ok(GLASS_TYPE_LABEL[g], `a label for ${g}`);

// The prompt: a venue's glass is its type in its drawing; the type's first drawing is stored as null.
assert.equal(drawingKey('coupe', 'coupe_wide'), null, 'the first drawing is the default');
assert.equal(drawingKey('coupe', 'coupe_deep'), 'coupe_deep');
assert.equal(drawingKey('coupe', 'martini_pony'), null, "another glass's drawing counts as the default");
const venue = [{ glass: 'coupe' as const, variant: null, is_default: true }];
assert.ok(hasGlass(venue, 'coupe', null));
assert.ok(hasGlass(venue, 'coupe', 'coupe_wide'), 'null and the first drawing are the same glass');
assert.ok(!hasGlass(venue, 'coupe', 'coupe_deep'), 'another shape of a glass it has is still asked about');
assert.ok(!hasGlass(venue, 'rocks', null));
assert.ok(isVenueGlassName(venue, 'Champagne coupe'), 'picked by type, whatever the name');
assert.ok(!isVenueGlassName(venue, 'Rocks'));
assert.ok(!isVenueGlassName(venue, 'Something odd'));
assert.equal(glassPromptKey('bar', 'coupe', 'coupe_wide'), 'bar:coupe:');
assert.equal(glassPromptKey('bar', 'coupe', 'coupe_deep'), 'bar:coupe:coupe_deep');
// Its size comes from the glassware item of the same name, the venue's own first.
const items = [
  { name: 'Coupe', bar_id: null, capacity_ml: 180, iced_capacity_ml: null },
  { name: 'coupe', bar_id: 'bar', capacity_ml: 210, iced_capacity_ml: null },
];
assert.equal(glassCapacity({ glass: 'coupe', variant: null, name: null }, items, 'bar'), '210 ml');
assert.equal(glassCapacity({ glass: 'coupe', variant: null, name: null }, items, 'other'), '180 ml');
assert.equal(glassCapacity({ glass: 'rocks', variant: null, name: null }, items, 'bar'), null);

console.log('glassware: ok');
