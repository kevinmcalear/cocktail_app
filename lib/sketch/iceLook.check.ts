import assert from 'node:assert/strict';

import { sketchBuild } from '../../supabase/functions/_shared/sketchRules';
import { GLASS_MM, GLASS_SHAPES, unitsPerMm } from './geometry';
import { paintSketch } from './paint';
import { boundsOf, type SceneEl } from './scene';
import { readIceLook, readSketchInputs, SKETCH_GLASSES, type IceLook, type SketchIce, type SketchInputs } from './types';

// Ice drawn as the venue's ice is (Kit and ice, step 10): size to scale, clear
// or cloudy, a stamp, something frozen inside, a Collins block on small pieces.

const base: SketchInputs = {
  v: 1, glass: 'rocks', ice: 'large', method: 'stir', liquid: { hex: '#c8873a', alpha: 0.6 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: null, from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1, variant: null,
};
const draw = (inputs: Partial<SketchInputs>, detail: 'full' | 'thumb' = 'full') => JSON.stringify(paintSketch({ ...base, ...inputs }, { seed: 'ice-look', detail }));
const PIECES: SketchIce[] = ['cubes', 'large', 'spear', 'sphere'];
const STACK = (look: IceLook): NonNullable<SketchInputs['build']> => [{ kind: 'cubes', n: 2, mm: 32, ...look }, { kind: 'spear', mm: 32, lengthMm: 120, ...look }];

// --- old inputs draw as they always have ---
// (Checked once against main when this landed: all 824 glass, ice, variant and build drawings matched.)
for (const glass of SKETCH_GLASSES) for (const ice of [...PIECES, 'crushed', 'none'] as SketchIce[]) {
  const old = draw({ glass, ice });
  // An empty, unreadable or out-of-range look, or a glass height on its own, changes nothing.
  for (const more of [{ iceLook: null }, { iceLook: {} }, { iceLook: { mm: 900, lengthMm: 2 } }, { glassMm: 120 }] as Partial<SketchInputs>[]) {
    assert.ok(draw({ glass, ice, ...more }) === old, `${glass}/${ice} with ${JSON.stringify(more)} draws as before`);
  }
}
for (const glass of ['highball', 'collins', 'rocks'] as const) {
  // A build with no look draws as before; a look on loose ice is ignored.
  assert.equal(draw({ glass, ice: 'spear', build: [{ kind: 'cubes', n: 2 }, { kind: 'spear' }] }), draw({ glass, ice: 'spear', build: [{ kind: 'cubes', n: 2 }, { kind: 'spear' }], glassMm: 140 }));
  assert.equal(draw({ glass, ice: 'crushed', build: [{ kind: 'crushed', to: 'mound', clear: true, stamp: true }] }), draw({ glass, ice: 'crushed', build: [{ kind: 'crushed', to: 'mound' }] }));
}

// --- each new input reaches the drawing ---
const LOOKS: IceLook[] = [{ mm: 50 }, { clear: true }, { clear: false }, { stamp: true }, { inside: true }, { mm: 32, lengthMm: 120, clear: true }];
for (const ice of PIECES) for (const look of LOOKS) {
  if (look.lengthMm && ice !== 'spear') continue;
  const glass = ice === 'spear' ? 'highball' : 'rocks';
  // A stamp on a cube that ends up hidden behind another could draw nothing new; cubes get the other looks.
  if (ice === 'cubes' && (look.stamp || look.inside)) continue;
  assert.ok(draw({ glass, ice, iceLook: look }) !== draw({ glass, ice }), `${ice} ${JSON.stringify(look)} changes the drawing`);
}
assert.notEqual(draw({ glass: 'highball', ice: 'spear', build: STACK({ clear: true }) }), draw({ glass: 'highball', ice: 'spear', build: STACK({ clear: false }) }));
assert.notEqual(draw({ glass: 'highball', ice: 'spear', build: STACK({}) }), draw({ glass: 'highball', ice: 'spear', build: [{ kind: 'cubes', n: 2 }, { kind: 'spear' }] }));

// Every glass with every piece and look draws, finite and within a phone's budget.
const walk = (els: SceneEl[], visit: (e: SceneEl) => void) => {
  for (const e of els) {
    visit(e);
    if (e.k === 'group' || e.k === 'stage') walk(e.children, visit);
  }
};
const ALL: IceLook = { mm: 45, lengthMm: 140, clear: true, stamp: true, inside: true };
for (const glass of SKETCH_GLASSES) for (const detail of ['full', 'thumb'] as const) {
  const scenes = [
    ...PIECES.flatMap((ice) => [{ ice, iceLook: ALL }, { ice, iceLook: { mm: 20, clear: false } }]),
    { ice: 'spear' as const, build: STACK({ clear: true, stamp: true }) },
    { ice: 'pebble' as const, build: [{ kind: 'cubes' as const, n: 4, mm: 25, clear: false }, { kind: 'pebble' as const, to: 'mound' as const }] },
  ].map((more) => paintSketch({ ...base, glass, ...more }, { seed: `${glass}-look`, detail }));
  for (const scene of scenes) {
    let n = 0;
    walk(scene.els, (e) => {
      assert.doesNotMatch(JSON.stringify(e), /NaN|Infinity|undefined/, `${glass}/${detail}: ${e.k}`);
      n += e.k === 'wash' ? e.ds.length : 1;
    });
    assert.ok(n <= (detail === 'thumb' ? 400 : 700), `${glass}/${detail}: ${n} shapes`);
  }
}

// --- to scale ---
// Units per mm: the glass's drawn height over its real one, the venue's glass first.
assert.equal(unitsPerMm(GLASS_SHAPES.rocks, 'rocks'), (86 - 40) / GLASS_MM.rocks);
assert.equal(unitsPerMm(GLASS_SHAPES.rocks, 'rocks', 92), (86 - 40) / 92);
// The ice reaches higher as it grows: a bigger cube, a longer spear, the same cube in a smaller glass.
const iceTop = (inputs: Partial<SketchInputs>) => {
  const stage = paintSketch({ ...base, ...inputs }, { seed: 'scale' }).els.find((e) => e.k === 'stage' && e.name === 'ice');
  const b = stage && stage.k === 'stage' ? boundsOf(stage.children) : null;
  assert.ok(b);
  return b[1];
};
assert.ok(iceTop({ ice: 'large', iceLook: { mm: 65 } }) < iceTop({ ice: 'large', iceLook: { mm: 40 } }));
assert.ok(iceTop({ ice: 'large', iceLook: { mm: 60 }, glassMm: 80 }) < iceTop({ ice: 'large', iceLook: { mm: 60 }, glassMm: 110 }));
assert.ok(iceTop({ glass: 'highball', ice: 'spear', iceLook: { lengthMm: 140 } }) < iceTop({ glass: 'highball', ice: 'spear', iceLook: { lengthMm: 90 } }));

// --- the contract: stored rows and build layers read only what can be drawn ---
assert.deepEqual(readIceLook({ mm: 50.4, lengthMm: 120, clear: true, stamp: true, inside: true }), { mm: 50, lengthMm: 120, clear: true, stamp: true, inside: true });
assert.deepEqual(readIceLook({ mm: '50', clear: 'yes', stamp: 1 }), null);
assert.deepEqual(readIceLook({ clear: false }), { clear: false });
const row = readSketchInputs({ ...base, iceLook: { mm: 50, clear: true, lava: 1 }, glassMm: 92, build: [{ kind: 'cubes', n: 2, mm: 32, clear: true }, { kind: 'spear', lengthMm: 120 }] });
assert.deepEqual(row?.iceLook, { mm: 50, clear: true });
assert.equal(row?.glassMm, 92);
assert.deepEqual(row?.build, [{ kind: 'cubes', n: 2, mm: 32, clear: true }, { kind: 'spear', lengthMm: 120 }]);
assert.equal(readSketchInputs({ ...base, iceLook: { mm: 0 }, glassMm: 9000 })?.iceLook, undefined);
assert.equal(readSketchInputs({ ...base, glassMm: 9000 })?.glassMm, undefined);
// The wizard's build by name keeps each layer's look.
assert.deepEqual(sketchBuild([{ name: 'Cubes', n: 2, mm: 32, clear: true }, { name: 'Collins spear', lengthMm: 120 }]), [{ kind: 'cubes', n: 2, mm: 32, clear: true }, { kind: 'spear', lengthMm: 120 }]);

console.log('ice look: ok');
