import assert from 'node:assert/strict';

import { SKETCH, SKETCH_CLEAR_TINT, SKETCH_TINT_FAMILIES, SKETCH_TINTS } from '../../constants/sketch';
import { DRINK_COLORS } from '../../supabase/functions/_shared/sketchRules';
import { paintSketch } from './paint';
import { mixHex } from './random';
import type { SceneEl } from './scene';
import { sceneToSvg } from './svg';
import { nearestTint, tintName } from './tintName';
import { liquidOf, readSketchInputs, withTint, type SketchInputs } from './types';

// The sketch colour a drink's editor picks (items.sketch_liquid, copied into
// item_sketches.inputs.tint by 20261017100000_sketch_liquid.sql) wins over
// the colour worked out from the spec, and Auto (no tint) gives that back.

const base: SketchInputs = {
  v: 2, glass: 'nick', ice: 'none', method: 'stir', liquid: { hex: '#7a4420', alpha: 0.9 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: 'cherry', from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1, variant: null,
};
const garnet = SKETCH_TINTS.find((t) => t.key === 'garnet')!.hex;

// The swatches: lowercase hex (what the database's check takes), each its own, the clear one the rules' clear.
assert.equal(SKETCH_TINTS.length, 24, 'eleven house colours and E27\'s thirteen');
for (const t of SKETCH_TINTS) assert.match(t.hex, /^#[0-9a-f]{6}$/, t.key);
assert.equal(new Set(SKETCH_TINTS.map((t) => t.hex)).size, SKETCH_TINTS.length);
assert.equal(new Set(SKETCH_TINTS.map((t) => t.key)).size, SKETCH_TINTS.length);
assert.equal(SKETCH_CLEAR_TINT, DRINK_COLORS.clear.toLowerCase());
assert.ok(SKETCH_TINTS.some((t) => t.hex === SKETCH_CLEAR_TINT));
// The picker's family rows hold every colour once.
const inRows = SKETCH_TINT_FAMILIES.flatMap((f) => f.keys);
assert.deepEqual([...inRows].sort(), SKETCH_TINTS.map((t) => t.key).sort());

// Reading a stored row: a tint is kept (lowercased), anything else is Auto.
assert.equal(readSketchInputs({ ...base, tint: '#6F1426' })?.tint, garnet);
assert.equal(readSketchInputs(base)?.tint ?? null, null);
assert.deepEqual(readSketchInputs(base), base, 'an Auto row reads back as stored');
for (const tint of ['red', '#fff', 'url(#x)', 12, null]) assert.equal(readSketchInputs({ ...base, tint })?.tint ?? null, null, String(tint));

// The tint wins; Auto is the worker's colour.
assert.deepEqual(liquidOf(base), base.liquid);
assert.deepEqual(liquidOf(withTint(base, null)), base.liquid);
assert.equal(liquidOf(withTint(base, garnet)).hex, garnet);
assert.equal(liquidOf(withTint(base, garnet)).alpha, 0.9, 'keeps the drink\'s strength');
// A clear drink tinted is a colour now; the clear swatch paints thin.
assert.equal(liquidOf({ liquid: { hex: SKETCH_CLEAR_TINT, alpha: 0.14 }, tint: garnet }).alpha, 0.75);
assert.equal(liquidOf(withTint(base, SKETCH_CLEAR_TINT)).alpha, 0.14);
// A raw row with something odd in it paints the worker's colour (the link previews paint rows unread).
assert.deepEqual(liquidOf({ liquid: base.liquid, tint: '"/><script>' }), base.liquid);

// It reaches the paint: the wash is the tint (muted by the graphite, as any colour), not the worker's colour.
const washes = (inputs: SketchInputs) => {
  const out = new Set<string>();
  const walk = (els: SceneEl[]) => {
    for (const e of els) {
      if (e.k === 'wash') out.add(e.color);
      if (e.k === 'group' || e.k === 'stage') walk(e.children);
    }
  };
  walk(paintSketch(inputs, { seed: 'tint' }).els);
  return out;
};
const muted = (hex: string) => mixHex(hex, SKETCH.mute, 0.22);
assert.ok(washes(withTint(base, garnet)).has(muted(garnet)), 'the tint is washed in');
assert.ok(!washes(withTint(base, garnet)).has(muted(base.liquid.hex)), 'the worker\'s colour is gone');
assert.ok(washes(withTint(base, null)).has(muted(base.liquid.hex)), 'Auto paints the worker\'s colour again');
// Only the colour changes: the same drink, glass and hand.
const shapes = (inputs: SketchInputs) => JSON.stringify(paintSketch(inputs, { seed: 'tint' })).replace(/"(color|edge)":"#[0-9a-f]{6}"/g, '');
assert.equal(shapes(withTint(base, garnet)), shapes(base));
// The link previews' path: a stored row straight into the SVG.
assert.ok(sceneToSvg(paintSketch({ ...base, tint: garnet }, { seed: 'og' })).includes(muted(garnet)));

console.log('sketch tint: ok');

// Naming a colour (the picker's label): Auto, a house name, or the nearest one's "from your photo".
assert.equal(tintName(null), 'Auto');
assert.equal(tintName(garnet), 'Garnet');
assert.equal(tintName('#b5793a'), 'Amber, from your photo');
assert.equal(nearestTint('#3b80c0').key, 'blue');
assert.equal(nearestTint('#100f0f').key, 'black');
console.log('sketch tint names: ok');
