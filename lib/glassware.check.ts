import assert from 'node:assert/strict';

import {
  drawingKey, GLASS_TYPE_LABEL, GLASS_TYPES, glassCapacity, glassFieldProblem, glassPromptKey, glassTitle, glassToAdd, hasGlass, isVenueGlassName, textOrNull,
} from './glassware';

const blank = { name: '', maker: '', designer: '', series: '', shape_note: '' };
assert.equal(glassFieldProblem(blank), null);
assert.deepEqual(glassFieldProblem({ ...blank, maker: 'x'.repeat(81) }), { field: 'maker', message: 'Keep it to 80 characters.' });
assert.equal(glassFieldProblem({ ...blank, maker: `  ${'x'.repeat(80)}  ` }), null, 'trimmed before counting');
assert.deepEqual(glassFieldProblem({ ...blank, shape_note: 'x'.repeat(501) })?.field, 'shape_note');
assert.equal(glassTitle({ name: '  ', glass: 'nick' }), 'Nick & Nora');
assert.equal(glassTitle({ name: 'Leopold coupe', glass: 'coupe' }), 'Leopold coupe');
assert.equal(textOrNull('  '), null);
assert.equal(textOrNull(' Kimura '), 'Kimura');
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
// Adding: named only when the name says more than the type; the main glass of its type when there's none.
assert.deepEqual(glassToAdd([], 'nick', null, 'Nick & Nora'), {
  glass: 'nick', variant: null, name: null, maker: null, maker_profile_id: null, designer: null, series: null, shape_note: null, is_default: true,
});
const deep = glassToAdd(venue, 'coupe', 'coupe_deep', ' Champagne coupe ');
assert.equal(deep.name, 'Champagne coupe');
assert.equal(deep.variant, 'coupe_deep');
assert.equal(deep.is_default, false, 'the venue already draws its coupes in another');
// Its size comes from the glassware item of the same name, the venue's own first.
const items = [
  { name: 'Coupe', bar_id: null, capacity_ml: 180, iced_capacity_ml: null },
  { name: 'coupe', bar_id: 'bar', capacity_ml: 210, iced_capacity_ml: null },
];
assert.equal(glassCapacity({ glass: 'coupe', variant: null, name: null }, items, 'bar'), '210 ml');
assert.equal(glassCapacity({ glass: 'coupe', variant: null, name: null }, items, 'other'), '180 ml');
assert.equal(glassCapacity({ glass: 'rocks', variant: null, name: null }, items, 'bar'), null);

console.log('glassware: ok');
