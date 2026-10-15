import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { drawingFor, LOADS, problemWith, render, rowsOf, readSeed, type SeedModel } from './glass-models';

// The migrations are what the seeds generate.
for (const load of LOADS) {
  const file = readFileSync(load.file, 'utf8');
  assert.equal(render(load), file, `${load.file} drifted from supabase/seeds/glass-models; run node --import tsx scripts/glass-models.ts`);
  assert.doesNotMatch(file, /[\u2014\u2013]/, `${load.file} has a long dash`);
  assert.doesNotMatch(file, /AUDIT: pending/, `${load.file} ships without its audit`);
}

// Every seed row loads, and each maker sits in exactly one load.
const makers = LOADS.flatMap((l) => l.makers);
assert.equal(new Set(makers).size, makers.length);
for (const maker of makers) assert.ok(rowsOf([readSeed(maker)]).length > 0, maker);

const row = (m: Partial<SeedModel>): SeedModel => ({
  name: 'Glass', series: null, designer: null, model_code: null, glass: 'rocks', variant: null, capacity_ml: null, capacity_as_stated: null,
  height_mm: null, rim_mm: null, material: 'glass', product_url: null, source_urls: ['https://example.com/glass'], ...m,
});

// The drawing: the researcher's pick when it's the glass's own, else the name or size.
assert.equal(drawingFor(row({ glass: 'coupe', variant: 'coupe_deep' })), 'coupe_deep');
assert.equal(drawingFor(row({ glass: 'coupe', variant: 'martini_pony' })), null, 'another glass\'s drawing is ignored');
assert.equal(drawingFor(row({ name: 'Gibraltar Shot', capacity_ml: 59 })), 'rocks_shot');
assert.equal(drawingFor(row({ name: 'Old Fashioned', capacity_ml: 355 })), 'rocks_double');
assert.equal(drawingFor(row({ name: 'Old Fashioned', capacity_ml: 266 })), null);
assert.equal(drawingFor(row({ glass: 'coupe', name: 'Champagne Saucer' })), 'coupe_saucer');
assert.equal(drawingFor(row({ glass: 'nick', name: 'Nick & Nora', capacity_ml: 120 })), 'nick_little');
assert.equal(drawingFor(row({ glass: 'martini', name: 'Cocktail', capacity_ml: 89 })), 'martini_pony');
assert.equal(drawingFor(row({ glass: 'collins', name: 'Poco Grande' })), 'collins_hurricane');
assert.equal(drawingFor(row({ glass: 'mug', name: 'Moscow Mule Mug', material: 'metal' })), 'mug_copper');
assert.equal(drawingFor(row({ glass: 'mug', name: 'Irish Coffee' })), 'mug_irish');
assert.equal(drawingFor(row({ glass: 'snifter', name: 'Whisky Nosing Glass' })), 'snifter_glencairn');

// What can't load.
assert.equal(problemWith(row({})), null);
assert.match(problemWith(row({ glass: 'wine' }))!, /not in scope/);
assert.match(problemWith(row({ source_urls: [] }))!, /sources/);
assert.match(problemWith(row({ source_urls: ['http://example.com'] }))!, /https/);
assert.match(problemWith(row({ material: 'unobtainium' }))!, /material/);
assert.match(problemWith(row({ capacity_ml: 0 }))!, /measure/);
assert.match(problemWith(row({ name: 'Coupe \u2014 tall' }))!, /dash/);

// One row per maker, name and size: a repeat is dropped, another size stays.
const twice = rowsOf([{ maker: 'm', models: [row({ name: 'A', capacity_ml: 200 }), row({ name: 'a', capacity_ml: 200 }), row({ name: 'A', capacity_ml: 300 })] }]);
assert.equal(twice.length, 2);

console.log('glass models: ok');
