import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { drawingFor, fillProblem, LOADS, nameKey, problemWith, readFills, render, rowsOf, readSeed, type SeedModel } from './glass-models';

// The migrations are what the seeds generate.
for (const load of LOADS) {
  const file = readFileSync(load.file, 'utf8');
  assert.equal(render(load), file, `${load.file} drifted from supabase/seeds/glass-models; run node --import tsx scripts/glass-models.ts`);
  assert.doesNotMatch(file, /[\u2014\u2013]/, `${load.file} has a long dash`);
  assert.doesNotMatch(file, /AUDIT: pending/, `${load.file} ships without its audit`);
}

// Every seed row loads, and each seed file sits in exactly one load (a maker's later waves in their own files).
const files = LOADS.flatMap((l) => l.files ?? l.makers);
assert.equal(new Set(files).size, files.length);
for (const f of files) assert.ok(rowsOf([readSeed(f)]).length > 0, f);
// No row any load writes shares the database's key (maker, ingredient_key(name), capacity) with another:
// a later wave must add glasses, never overwrite one an earlier load wrote.
const keys = new Map<string, string>();
for (const l of LOADS) {
  for (const r of rowsOf((l.files ?? l.makers).map(readSeed))) {
    const k = `${r.maker}\0${nameKey(r.name)}\0${r.capacity_ml ?? 0}`;
    assert.ok(!keys.has(k), `${r.maker} ${r.name} (${l.file}) has the key of ${keys.get(k)}`);
    keys.set(k, `${r.name} (${l.file})`);
  }
}
assert.equal(nameKey("Denk'Art Nick & Nora Café"), 'denkart nick and nora cafe');
for (const l of LOADS) assert.deepEqual([...new Set((l.files ?? l.makers).map((f) => readSeed(f).maker))].sort(), [...l.makers].sort(), `${l.file} names its makers`);

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
assert.match(problemWith(row({ glass: 'ceramic' }))!, /not in scope/);
assert.match(problemWith(row({ source_urls: [] }))!, /sources/);
assert.match(problemWith(row({ source_urls: ['http://example.com'] }))!, /https/);
assert.match(problemWith(row({ material: 'unobtainium' }))!, /material/);
assert.match(problemWith(row({ capacity_ml: 0 }))!, /measure/);
assert.match(problemWith(row({ capacity_as_stated: '322 ml / 11,35 US fl. oz. full capacity (drawing)' }))!, /40/);
assert.match(problemWith(row({ series: 'x'.repeat(81) }))!, /80/);
assert.match(problemWith(row({ model_code: ' ' }))!, /blank/);
assert.match(problemWith(row({ name: 'Coupe \u2014 tall' }))!, /dash/);

// One row per maker, name and size: a repeat is dropped, another size stays.
const twice = rowsOf([{ maker: 'm', models: [row({ name: 'A', capacity_ml: 200 }), row({ name: 'a', capacity_ml: 200 }), row({ name: 'A', capacity_ml: 300 })] }]);
assert.equal(twice.length, 2);

// A fill names one row of its maker that has no capacity yet; one that has
// a capacity, or a code that matches nothing, is refused.
for (const load of LOADS) {
  if (!load.fills) continue;
  const { maker, fills } = readFills(load.fills);
  for (const f of fills) assert.equal(fillProblem(f, readSeed(maker)), null, `${load.fills} ${f.model_code}`);
}
const fill = { model_code: 'A1', capacity_ml: 200, capacity_as_stated: '200 ml', source_url: 'https://example.com/a1.png' };
const seedOf = (m: Partial<SeedModel>) => ({ maker: 'm', models: [row({ model_code: 'A1', ...m })] });
assert.equal(fillProblem(fill, seedOf({})), null);
assert.match(fillProblem(fill, seedOf({ capacity_ml: 180 }))!, /already/);
assert.match(fillProblem({ ...fill, model_code: 'B2' }, seedOf({}))!, /0 rows/);

console.log('glass models: ok');
