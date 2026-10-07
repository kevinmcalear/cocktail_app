import assert from 'node:assert/strict';

import { paintSketch } from './paint';
import { mixHex } from './random';
import type { SceneEl } from './scene';
import { readSketchInputs, SKETCH_FOAMS, SKETCH_GARNISHES, SKETCH_GLASSES, SKETCH_ICES, type SketchInputs } from './types';

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

const base: SketchInputs = {
  v: 1, glass: 'rocks', ice: 'large', method: 'stir', liquid: { hex: '#a01c26', alpha: 0.95 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: 'orange_peel', from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1,
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
