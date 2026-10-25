import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LOADS, outlineProblem, readSeeds, render } from './glass-outlines';
import { hasSeed, LOADS as MODEL_LOADS, nameKey, readFills, readSeed } from './glass-models';

// Each migration is what its seeds generate.
const longDash = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
for (const load of LOADS) {
  const file = readFileSync(load.file, 'utf8');
  assert.equal(render(load), file, `${load.file} drifted from ${load.dir}; run node --import tsx scripts/glass-outlines.ts`);
  assert.doesNotMatch(file, longDash, `${load.file} has a long dash`);
  assert.doesNotMatch(file, /AUDIT: pending/, `${load.file} ships without its audit`);
}

// Every outline names a catalog glass that exists when its load runs (rows and filled capacities from
// the catalog loads before it), once across the loads, keyed as the database keys it; and it stores
// numbers, colours and a page only.
const seen = new Set<string>();
const seeded = new Set(MODEL_LOADS.flatMap((m) => (m.files ?? m.makers).filter(hasSeed).map((f) => readSeed(f).maker)));
for (const load of LOADS) {
  const before = MODEL_LOADS.filter((m) => m.file < load.file);
  const fills = new Map(before.flatMap((m) => (m.fills ? readFills(m.fills).fills : [])).map((f) => [f.model_code, f.capacity_ml]));
  const catalog = new Map<string, Set<string>>();
  for (const m of before) {
    for (const f of (m.files ?? m.makers).filter(hasSeed)) {
      const seed = readSeed(f);
      const rows = catalog.get(seed.maker) ?? new Set<string>();
      for (const r of seed.models) rows.add(`${nameKey(r.name)}\0${r.capacity_ml ?? (r.model_code && fills.get(r.model_code)) ?? 0}`);
      catalog.set(seed.maker, rows);
    }
  }
  for (const s of readSeeds(load.dir)) {
    // A maker loaded by a migration that isn't generated from a seed has no rows here to check against.
    const rows = catalog.get(s.maker);
    assert.ok(rows || !seeded.has(s.maker), `${s.maker}'s glasses load after ${load.file}`);
    for (const o of s.outlines) {
      const k = `${s.maker}\0${nameKey(o.name)}\0${o.capacity_ml ?? 0}`;
      assert.ok(!seen.has(k), `${s.maker} ${o.name} twice`);
      seen.add(k);
      if (rows) assert.ok(rows.has(`${nameKey(o.name)}\0${o.capacity_ml ?? 0}`), `${s.maker} ${o.name} ${o.capacity_ml} is not in the catalog before ${load.file}`);
      assert.equal(outlineProblem(o.outline), null, `${s.maker} ${o.name}`);
      for (const v of Object.values(o.outline)) if (typeof v === 'string') assert.match(v, /^(https:\/\/\S+|#[0-9a-f]{6})$/);
    }
  }
}

// What can't load: a broken outline, one that doesn't reach its height, a source that isn't a page.
const good = {
  height_mm: 100, rim_mm: 80, widest_mm: 80, stemmed: false,
  outline: [[0, 80], [50, 78], [100, 70]] as [number, number][], traced_from: 'https://example.com/glass',
};
assert.equal(outlineProblem(good), null);
assert.match(outlineProblem({ ...good, outline: [[0, 80]] })!, /draw/);
assert.match(outlineProblem({ ...good, height_mm: 120 })!, /height/);
assert.match(outlineProblem({ ...good, traced_from: 'http://example.com' })!, /https/);
assert.match(outlineProblem({ ...good, stemmed: true })!, /draw/, 'a stemmed glass needs its bowl and stem');

console.log(`glass outlines: ${seen.size} ok`);
