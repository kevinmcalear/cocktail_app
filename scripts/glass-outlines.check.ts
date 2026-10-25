import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LOADS, outlineProblem, readSeeds, render } from './glass-outlines';
import { LOADS as MODEL_LOADS, readFills, readSeed } from './glass-models';

// Each migration is what its seeds generate.
const longDash = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
for (const load of LOADS) {
  const file = readFileSync(load.file, 'utf8');
  assert.equal(render(load), file, `${load.file} drifted from ${load.dir}; run node --import tsx scripts/glass-outlines.ts`);
  assert.doesNotMatch(file, longDash, `${load.file} has a long dash`);
  assert.doesNotMatch(file, /AUDIT: pending/, `${load.file} ships without its audit`);
}

// Every outline names a catalog glass, once across the loads, and stores numbers, colours and a page only.
const seeds = LOADS.flatMap((l) => readSeeds(l.dir));
const seen = new Set<string>();
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// A maker's catalog: its own seed and its later waves' files.
const waves = new Set(MODEL_LOADS.flatMap((l) => l.files ?? []));
const seedFiles = (maker: string) => [maker, ...(waves.has(`${maker}.wave5`) ? [`${maker}.wave5`] : [])];
for (const s of seeds) {
  let catalog: Set<string> | null = null;
  try {
    // A capacity a later load filled in counts as the row's.
    const fills = new Map(MODEL_LOADS.flatMap((l) => (l.fills ? readFills(l.fills).fills : [])).map((f) => [f.model_code, f.capacity_ml]));
    catalog = new Set(seedFiles(s.maker).flatMap((f) => readSeed(f).models.map((m) => `${key(m.name)}\0${m.capacity_ml ?? (m.model_code && fills.get(m.model_code)) ?? 0}`)));
  } catch {
    // A maker whose rows were loaded from a migration that isn't generated from a seed.
  }
  for (const o of s.outlines) {
    const k = `${s.maker}\0${key(o.name)}\0${o.capacity_ml ?? 0}`;
    assert.ok(!seen.has(k), `${s.maker} ${o.name} twice`);
    seen.add(k);
    if (catalog) assert.ok(catalog.has(`${key(o.name)}\0${o.capacity_ml ?? 0}`), `${s.maker} ${o.name} ${o.capacity_ml} is not in its catalog seed`);
    assert.equal(outlineProblem(o.outline), null, `${s.maker} ${o.name}`);
    for (const v of Object.values(o.outline)) if (typeof v === 'string') assert.match(v, /^(https:\/\/\S+|#[0-9a-f]{6})$/);
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
