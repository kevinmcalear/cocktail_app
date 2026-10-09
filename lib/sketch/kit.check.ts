import assert from 'node:assert/strict';

import { EQUIPMENT } from '@/lib/techniques/equipment';

import { KIT_KINDS, KIT_VARIANTS, kitArt, paintKit, type KitArt } from './kit';

// Every piece of kit maps to a drawing that exists.
for (const e of EQUIPMENT) {
  const art = kitArt(e.id);
  assert.ok(KIT_KINDS.includes(art.kind), `${e.id} maps to a kind`);
  if (art.variant) assert.ok(KIT_VARIANTS[art.kind]?.includes(art.variant), `${e.id}: ${art.kind} has a ${art.variant}`);
}
assert.deepEqual(kitArt('a-thing-we-have-never-heard-of'), { kind: 'box' }, 'unknown kit is drawn as a box');

// Every kind and variant draws something at both sizes, with no NaN.
const all: KitArt[] = KIT_KINDS.flatMap((kind) => (KIT_VARIANTS[kind] ?? [undefined]).map((variant) => ({ kind, variant })));
for (const art of all) {
  for (const detail of ['full', 'thumb'] as const) {
    const scene = paintKit(art, { seed: `check-${art.kind}`, detail });
    const label = `${art.kind}${art.variant ? `/${art.variant}` : ''} (${detail})`;
    assert.ok(scene.els.length > 5, `${label} draws something`);
    assert.ok(!JSON.stringify(scene).includes('NaN'), `${label} has no NaN`);
  }
}

// The same kit always draws the same way, and the thumb is lighter.
for (const id of ['shaker', 'scale-fine', 'droppers', 'torch']) {
  assert.deepEqual(paintKit(kitArt(id), { seed: id }), paintKit(kitArt(id), { seed: id }), `${id} is deterministic`);
  assert.ok(JSON.stringify(paintKit(kitArt(id), { seed: id, detail: 'thumb' })).length < JSON.stringify(paintKit(kitArt(id), { seed: id })).length, `${id} thumb is lighter`);
}

console.log('kit: ok');
