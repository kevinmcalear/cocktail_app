import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import {
  drawingKey, GLASS_TYPE_LABEL, kindColumns, typedKind, GLASS_TYPES, glassCapacity, glassPromptKey, glassTitle, hasGlass, isVenueGlassName,
} from './glassware';
import { draftSketchInputs } from './sketch/draft';
import { GLASS_SHAPES, glassShape } from './sketch/geometry';
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
assert.ok(isVenueGlassName(venue, { name: 'Something odd', kind: 'coupe' }), 'its kind before its name');
assert.ok(!isVenueGlassName(venue, { name: 'Coupe', glass: 'rocks' }), 'a row that says rocks is rocks');

// A new item saves only a kind the database takes.
assert.deepEqual(kindColumns('glassware', 'tiki'), { glass: 'tiki' });
assert.deepEqual(kindColumns('ice', 'sphere'), { ice_kind: 'sphere' });
assert.deepEqual(kindColumns('glassware', null), {}, 'not sure saves nothing');
assert.deepEqual(kindColumns('glassware', 'sphere'), {}, 'an ice kind is no glass');
assert.deepEqual(kindColumns('method', 'tiki'), {});

// The guess the question starts on: from the name being typed, never no ice.
assert.equal(typedKind('glass', 'Tiki bowl'), 'tiki');
assert.equal(typedKind('glass', 'Grandma'), null);
assert.equal(typedKind('ice', 'Hosh'), 'cubes');
assert.equal(typedKind('ice', 'No ice please'), null);
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

// Shot and Cordial (d66, 20261126100000_shot_and_cordial_glasses.sql): named, read from names, drawn, served neat.
assert.deepEqual([GLASS_TYPE_LABEL.shot, GLASS_TYPE_LABEL.cordial], ['Shot', 'Cordial']);
assert.deepEqual(kindColumns('glassware', 'cordial'), { glass: 'cordial' });
for (const [name, glass] of [
  ['Shot glass', 'shot'], ['Tequila shooter', 'shot'], ['Shot tumbler', 'shot'], ['Caballito', 'shot'],
  ['Cordial glass', 'cordial'], ['Chartreuse glass', 'cordial'], ['Liqueur glass', 'cordial'], ['Pony', 'nick'], ['Rocks', 'rocks'],
] as const) assert.equal(typedKind('glass', name), glass, name);
assert.ok(!GLASS_SHAPES.shot.stemmed && GLASS_SHAPES.cordial.stemmed, 'a shot stands on its base, a cordial on a stem');
assert.ok(GLASS_SHAPES.shot.rim > GLASS_SHAPES.rocks.rim, 'a shot is drawn lower than a rocks glass');
assert.equal(glassShape('rocks', 'rocks_shot'), GLASS_SHAPES.shot, "a rocks glass drawn as a shot is the Shot's drawing");
const look = (d: Partial<Parameters<typeof draftSketchInputs>[0]>) => draftSketchInputs({ name: 'Test', lines: [{ name: 'Tequila', amount: 30, unit: 'ml' }], ...d });
assert.deepEqual([look({ glassKind: 'shot', methods: ['Shake'] }).ice, look({ glass: 'Cordial glass' }).ice], ['none', 'none'], 'neat unless it says');
assert.equal(look({ glassKind: 'shot', ice: 'Cubes' }).ice, 'cubes');
assert.equal(look({ name: 'Lemon Drop Shot' }).glass, 'shot');
assert.equal(look({ name: 'Pousse Café' }).glass, 'cordial');
assert.notEqual(look({ name: 'Morning', description: 'Rum and a shot of espresso' }).glass, 'shot', 'a shot of something is not a shot glass');
assert.notEqual(look({ name: 'Morning', description: 'Rum, coffee liqueur and an espresso shot' }).glass, 'shot', 'nor a description that ends in one');
assert.equal(look({ name: 'Morning', description: 'Served as a shot.' }).glass, 'shot');
assert.deepEqual(listed('is_ice_kind'), [...SKETCH_ICES]);

console.log('glassware: ok');
