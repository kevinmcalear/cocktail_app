import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FILE, outlineProblem, readSeeds, render } from './glass-outlines';
import { readSeed } from './glass-models';

// The migration is what the seeds generate.
const file = readFileSync(FILE, 'utf8');
assert.equal(render(), file, `${FILE} drifted from supabase/seeds/glass-outlines; run node --import tsx scripts/glass-outlines.ts`);
const longDash = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
assert.doesNotMatch(file, longDash, `${FILE} has a long dash`);

// Every outline names a catalog glass, once, and stores numbers, colours and a page only.
const seeds = readSeeds();
const seen = new Set<string>();
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
for (const s of seeds) {
  let catalog: Set<string> | null = null;
  try {
    catalog = new Set(readSeed(s.maker).models.map((m) => `${key(m.name)}\0${m.capacity_ml ?? 0}`));
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
