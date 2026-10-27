import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import {
  drawingKey, GLASS_TYPE_LABEL, GLASS_TYPES, glassCapacity, glassPromptKey, glassTitle, hasGlass, isVenueGlassName,
} from './glassware';
import { SKETCH_GLASSES, SKETCH_ICES } from './sketch/types';

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

// The database's glass types and ice kinds are the drawing's, word for word
// (private.is_glass_type and private.is_ice_kind, 20261124100000_glass_ice_kinds.sql).
const dir = new URL('../supabase/migrations/', import.meta.url);
const migrations = readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), 'utf8'));
const listed = (fn: string) => {
  const sql = migrations.filter((s) => s.includes(`FUNCTION "private"."${fn}"`)).pop();
  assert.ok(sql, `a migration makes private.${fn}`);
  const body = sql.slice(sql.indexOf(`FUNCTION "private"."${fn}"`)).match(/SELECT p IN \(([^)]+)\)/)![1];
  return body.match(/'([^']+)'/g)!.map((v) => v.slice(1, -1));
};
assert.deepEqual(listed('is_glass_type'), [...SKETCH_GLASSES]);
assert.deepEqual(listed('is_ice_kind'), [...SKETCH_ICES]);

console.log('glassware: ok');
