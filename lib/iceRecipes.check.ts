import assert from 'node:assert/strict';

import { ICE_EXTRA_STEPS, ICE_WAY_KEYS, ICE_WAYS, iceWaySteps } from './iceRecipes';
import { equipmentById } from './techniques/equipment';

// Kevin's twelve ways: six common first, six behind "More ways", ending with our own.
assert.deepEqual(ICE_WAYS.map((w) => w.key), [...ICE_WAY_KEYS]);
assert.deepEqual(ICE_WAYS.filter((w) => w.common).map((w) => w.key), ['cut', 'mould', 'clear', 'lewis', 'crack', 'press']);
assert.equal(ICE_WAYS.at(-1)?.key, 'own');
assert.equal(ICE_WAYS.at(-1)?.steps.length, 0);

// Every tool a step names is ours, a step names at most 12 (item_steps.equipment), and nothing has an em dash.
for (const s of [...ICE_WAYS.flatMap((w) => w.steps), ...ICE_EXTRA_STEPS.map((x) => x.step)]) {
  assert.ok(s.tools.length <= 12);
  for (const t of s.tools) assert.ok(equipmentById(t), `unknown tool ${t}`);
}
assert.ok(!JSON.stringify([ICE_WAYS, ICE_EXTRA_STEPS]).includes(String.fromCharCode(0x2014)), 'no em dashes');

// The ice's own size and what's frozen inside fill in; nothing is left in braces.
const prism = iceWaySteps('inside', { size_mm: 45, frozen_inside: 'A glass prism' });
assert.match(prism[1].body, /^Lay the glass prism on the ice/);
assert.match(prism.at(-1)!.body, /trim to 45 mm/);
assert.match(iceWaySteps('cut', {})[2].body, /the size you want/);
for (const w of ICE_WAYS) for (const s of iceWaySteps(w.key, { size_mm: 50, frozen_inside: 'mint' })) assert.ok(!/[{}]/.test(s.body), `${w.key}: ${s.body}`);

// A stamped ice gets a stamp step before the last one, unless the way is stamping already.
const stamped = iceWaySteps('cut', { size_mm: 50, stamped: true });
assert.deepEqual(stamped.at(-2)?.tools, ['ice-stamp']);
assert.equal(iceWaySteps('stamp', { stamped: true }).filter((s) => s.tools.includes('ice-stamp')).length, 1);
assert.equal(iceWaySteps('own', { stamped: true }).length, 0);
for (const k of ['lewis', 'crack', 'shave'] as const) assert.ok(!iceWaySteps(k, { stamped: true }).some((s) => s.tools.includes('ice-stamp')), `${k} isn't stamped`);

console.log('iceRecipes: ok');
