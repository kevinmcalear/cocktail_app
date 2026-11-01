// Checks for lib/tones.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { backbar } from '../constants/tokens';
import { contrast } from './color';
import { hexToOklch } from './sky';
import { itemTones, photoTones } from './tones';

const ACCENT = '#D0643B';
const LIQUIDS = ['#caa26b', '#9f363b', '#8F887E', '#D8BE6A', '#9A3043', '#B06A2E', '#D9B27A', '#2E6B4F', '#2B4A8F', '#6A3D9A'];

for (const liquid of LIQUIDS) {
  for (const scheme of ['light', 'dark'] as const) {
    const t = itemTones(liquid, ACCENT, scheme);
    const ink = backbar[scheme].ink;
    assert.ok(contrast(t.primary, t.onPrimary) >= 4.5, `${liquid} ${scheme}: the picked half reads`);
    assert.ok(contrast(t.tonal, ink) >= 4.5, `${liquid} ${scheme}: ink reads on a tonal button`);
    assert.ok(contrast(t.fab, t.onFab) >= 4.5, `${liquid} ${scheme}: the FAB reads`);
    assert.ok(contrast(t.tile, ink) >= 4.5, `${liquid} ${scheme}: ink reads on a tile`);
    assert.ok(contrast(t.bar, ink) >= 4.5, `${liquid} ${scheme}: the title reads on the filled bar`);
  }
}

// The controls wear the drink's hue, not the accent's.
const pen = itemTones('#caa26b', ACCENT, 'light');
assert.ok(Math.abs(hexToOklch(pen.tonal).H - hexToOklch('#caa26b').H) < 8, 'tonal keeps the drink hue');
assert.equal(pen.circle, null, 'no circles on a drawing');

// A clear drink is icy blue; an item with no colour takes the accent; a warning never takes either.
assert.ok(Math.abs(hexToOklch(itemTones('#8F887E', ACCENT, 'light').tonal).H - 235) < 10, 'clear drink is icy');
assert.ok(Math.abs(hexToOklch(itemTones(null, ACCENT, 'light').tonal).H - hexToOklch(ACCENT).H) < 8, 'no colour: the accent');
// A grey or black accent stays neutral, never a hue from rounding.
for (const grey of ['#000000', '#7A7A7A', '#FFFFFF']) assert.ok(hexToOklch(itemTones(null, grey, 'light').primary).C < 0.05, `${grey}: neutral`);
assert.deepEqual(itemTones('#2B4A8F', ACCENT, 'light').warn, itemTones('#9f363b', ACCENT, 'light').warn);

// Over a photo: circles, and neutral controls that read.
for (const scheme of ['light', 'dark'] as const) {
  const t = photoTones(scheme);
  assert.ok(t.circle, `${scheme}: circles over the photo`);
  assert.ok(contrast(t.primary, t.onPrimary) >= 4.5, `${scheme}: the picked half reads`);
  assert.ok(contrast(t.fab, t.onFab) >= 4.5, `${scheme}: the FAB reads`);
}
