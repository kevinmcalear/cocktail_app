import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { paintSketch } from './paint';
import { readOutline, shapeFromOutline, tracedIce, type GlassOutline } from './outline';
import { sceneToSvg } from './svg';
import { readSketchInputs, type SketchInputs } from './types';

const rocks: GlassOutline = { height_mm: 90, rim_mm: 80, widest_mm: 80, stemmed: false, outline: [[0, 80], [45, 78], [90, 72]] };
const highball: GlassOutline = { ...rocks, height_mm: 160, outline: [[0, 70], [80, 68], [160, 64]] };

// One scale for every glass: a 90 mm rocks glass stands lower than a 160 mm highball, both on the same ground.
const r = shapeFromOutline('rocks', rocks);
const h = shapeFromOutline('highball', highball);
assert.ok(r.rim > h.rim, 'the shorter glass has the lower rim');
assert.equal(r.prof.at(-1)![0], h.prof.at(-1)![0], 'both stand on the same ground');
assert.ok(Math.abs((r.prof.at(-1)![0] - r.rim) / (h.prof.at(-1)![0] - h.rim) - 90 / 160) < 1e-9);

// A traced stemmed glass is drawn stemmed whatever the family says, and its foot only widens toward the table.
const coupe: GlassOutline = {
  height_mm: 120, rim_mm: 90, widest_mm: 90, stemmed: true, bowl_mm: 55, stem_to_mm: 104, stem_mm: 9, foot_mm: 80,
  outline: [[0, 90], [30, 70], [55, 20]], stem_profile: [[55, 20], [80, 9], [104, 16]], foot_profile: [[104, 16], [110, 60], [114, 40], [120, 80]],
};
const c = shapeFromOutline('rocks', coupe);
assert.equal(c.stemmed, true);
const foot = c.footProf!.map(([, w]) => w);
assert.deepEqual(foot, [...foot].sort((a, b) => a - b), 'the foot never narrows on the way down');

// Pieces of ice in a traced glass get their usual sizes, unless the venue gave one; loose ice has none.
assert.deepEqual(tracedIce('large', null), { mm: 50 });
assert.deepEqual(tracedIce('cubes', { mm: 25, clear: true }), { mm: 25, clear: true });
assert.equal(tracedIce('crushed', null), null);

// Stored inputs read the outline back, and drop one that isn't drawable.
const base = {
  v: 1, glass: 'coupe', ice: 'none', method: 'shake', liquid: { hex: '#d8a24a', alpha: 0.6 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: null, from: { glass: 'data', ice: 'data', method: 'data', liquid: 'data', garnish: 'data' }, coverage: 1, variant: null,
};
assert.deepEqual(readSketchInputs({ ...base, outline: coupe })?.outline, readOutline(coupe));
assert.equal(readSketchInputs({ ...base, outline: { height_mm: 100 } })?.outline, undefined);

// Every loaded outline paints, and differently from the family's glass.
const plain = sceneToSvg(paintSketch(base as SketchInputs, { seed: 'check', detail: 'thumb' }));
let n = 0;
for (const f of readdirSync('supabase/seeds/glass-outlines')) {
  const { outlines } = JSON.parse(readFileSync(`supabase/seeds/glass-outlines/${f}`, 'utf8')) as { outlines: { outline: unknown }[] };
  for (const o of outlines.filter((_, i) => i % 10 === 0)) {
    const outline = readOutline(o.outline);
    assert.ok(outline, f);
    assert.notEqual(sceneToSvg(paintSketch({ ...(base as SketchInputs), ice: 'cubes', outline }, { seed: 'check', detail: 'thumb' })), plain);
    n++;
  }
}
console.log(`traced outlines: ${n} painted`);
