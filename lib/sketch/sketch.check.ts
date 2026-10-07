import assert from 'node:assert/strict';

import * as shared from '../../supabase/functions/_shared/sketch';
import { GLASS_SHAPES, GLASS_VARIANTS, glassShape, variantsOf } from './geometry';
import { paintSketch } from './paint';
import { CRUMB } from './styles';
import { mixHex } from './random';
import type { SceneEl } from './scene';
import { readSketchInputs, SKETCH_FOAMS, SKETCH_GARNISHES, SKETCH_GLASSES, SKETCH_ICES, SKETCH_METHODS, type SketchInputs } from './types';

// The app draws what the worker stores: the lists must match
// (supabase/functions/_shared/sketch.ts).
assert.deepEqual([...SKETCH_GLASSES], [...shared.GLASSES]);
assert.deepEqual([...SKETCH_ICES], [...shared.ICES]);
assert.deepEqual([...SKETCH_METHODS], [...shared.METHODS]);
assert.deepEqual([...SKETCH_FOAMS], [...shared.FOAMS]);
assert.deepEqual([...SKETCH_GARNISHES], [...shared.GARNISHES]);

// Stored rows are read strictly: anything this app can't draw is null.
assert.equal(readSketchInputs(null), null);
assert.equal(readSketchInputs({ glass: 'goblet', ice: 'none', method: 'stir', liquid: { hex: '#ffffff', alpha: 1 } }), null);
assert.equal(readSketchInputs({ glass: 'rocks', ice: 'none', method: 'stir', liquid: { hex: 'red', alpha: 1 } }), null);
const read = readSketchInputs({ v: 1, glass: 'rocks', ice: 'large', method: 'stir', liquid: { hex: '#A01C26', alpha: 3 }, foam: 'lots', garnish: 'orange_peel', fizz: 'yes' });
assert.ok(read);
assert.equal(read.liquid.alpha, 1);
assert.equal(read.liquid.hex, '#a01c26');
assert.equal(read.foam, null);
assert.equal(read.fizz, false);
assert.equal(read.variant, null);
// A variant only counts for its own glass.
assert.equal(readSketchInputs({ ...read, variant: 'rocks_heavy' })?.variant, 'rocks_heavy');
assert.equal(readSketchInputs({ ...read, variant: 'martini_petite' })?.variant, null);

// Variant keys are '<glass>_<name>', what the database accepts
// (20261007100000_glass_variants.sql), each glass's first is its default
// shape, and an unknown key draws the default.
for (const glass of SKETCH_GLASSES) {
  const list = variantsOf(glass);
  assert.equal(list[0].shape, GLASS_SHAPES[glass]);
  assert.equal(new Set(list.map((x) => x.key)).size, list.length);
  for (const x of list) assert.match(x.key, new RegExp(`^${glass}_[a-z]+$`));
}
assert.equal(glassShape('martini', 'martini_nope'), GLASS_SHAPES.martini);
assert.equal(glassShape('martini', 'coupe_deep'), GLASS_SHAPES.martini);
assert.notEqual(glassShape('coupe', 'coupe_deep'), GLASS_SHAPES.coupe);

const base: SketchInputs = {
  v: 1, glass: 'rocks', ice: 'large', method: 'stir', liquid: { hex: '#a01c26', alpha: 0.95 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: 'orange_peel', from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1, variant: null,
};

const walk = (els: SceneEl[], visit: (e: SceneEl) => void) => {
  for (const e of els) {
    visit(e);
    if (e.k === 'group') walk(e.children, visit);
  }
};
const weight = (els: SceneEl[]) => {
  let n = 0;
  let bytes = 0;
  walk(els, (e) => {
    n += e.k === 'wash' ? e.ds.length : 1;
    bytes += e.k === 'wash' ? e.ds.join('').length : e.k === 'group' ? e.clip.length : 'd' in e ? e.d.length : 0;
  });
  return { n, bytes };
};

// Every glass, ice, foam and garnish draws, with finite numbers and within a phone's budget.
for (const glass of SKETCH_GLASSES) for (const ice of SKETCH_ICES) {
  for (const detail of ['full', 'thumb'] as const) {
    const foam = SKETCH_FOAMS[(glass.length + ice.length) % SKETCH_FOAMS.length];
    const garnish = SKETCH_GARNISHES[(glass.length * 7 + ice.length) % SKETCH_GARNISHES.length];
    const scene = paintSketch({ ...base, glass, ice, foam, garnish, fizz: true, float: ice === 'large' ? '#7a4a1e' : null, bleed: ice === 'crushed' ? '#5a1240' : null }, { seed: `${glass}-${ice}`, detail });
    walk(scene.els, (e) => assert.doesNotMatch(JSON.stringify(e), /NaN|Infinity|undefined/, `${glass}/${ice}/${detail}: ${e.k}`));
    const { n, bytes } = weight(scene.els);
    const cap = detail === 'thumb' ? { n: 400, bytes: 160_000 } : { n: 700, bytes: 260_000 };
    assert.ok(n <= cap.n && bytes <= cap.bytes, `${glass}/${ice}/${detail}: ${n} shapes, ${bytes} bytes`);
  }
}

// Every variant draws too.
for (const [glass, list] of Object.entries(GLASS_VARIANTS)) for (const x of list) for (const ice of SKETCH_ICES) {
  const scene = paintSketch({ ...base, glass: glass as SketchInputs['glass'], ice, variant: x.key, fizz: true, foam: 'cap' }, { seed: x.key });
  walk(scene.els, (e) => assert.doesNotMatch(JSON.stringify(e), /NaN|Infinity|undefined/, `${x.key}/${ice}: ${e.k}`));
  assert.ok(weight(scene.els).n <= 700, `${x.key}/${ice}`);
}
assert.notEqual(JSON.stringify(paintSketch({ ...base, variant: 'rocks_heavy' }, { seed: 'v' })), JSON.stringify(paintSketch(base, { seed: 'v' })));

// A tile and the drink's page place everything alike: the same frost, rim and
// spice dots, wherever they fall after the ice, foam, bubbles and garnish.
const placed = (detail: 'full' | 'thumb') => {
  const out: string[] = [];
  walk(paintSketch({ ...base, glass: 'julep', ice: 'crushed', garnish: 'grated_spice', fizz: true }, { seed: 'same', detail }).els, (e) => {
    if (e.k === 'fill' && e.d.includes('a') && e.color !== CRUMB) out.push(e.d);
  });
  return out;
};
assert.ok(placed('full').length > 0);
assert.deepEqual(placed('thumb'), placed('full'));

// The same drink always draws the same way; another drink doesn't.
const a = JSON.stringify(paintSketch(base, { seed: 'drink-a' }));
assert.equal(JSON.stringify(paintSketch(base, { seed: 'drink-a' })), a);
assert.notEqual(JSON.stringify(paintSketch(base, { seed: 'drink-b' })), a);

// A thumbnail is lighter than the full drawing.
assert.ok(weight(paintSketch(base, { seed: 'x', detail: 'thumb' }).els).n < weight(paintSketch(base, { seed: 'x' }).els).n);

// The drink's own colour reaches the paint.
// Graphite mutes the wash a little towards grey.
const muted = mixHex('#a01c26', '#9A9086', 0.22);
let sawLiquid = false;
walk(paintSketch(base, { seed: 'c' }).els, (e) => {
  if (e.k === 'wash' && e.color === muted) sawLiquid = true;
});
assert.ok(sawLiquid, `the liquid is washed in as ${muted}`);

console.log('sketch renderer: ok');
