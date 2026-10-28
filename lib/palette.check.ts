// Checks for lib/palette.ts.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { backbar } from '@/constants/tokens';

import { usableGroundTint } from './brand';
import { contrast } from './color';
import { fromLch, groundOf, groundTintFor, neutralsFor, PALETTES, palettesFor, shadeNotes, toLch } from './palette';

// The round trip through OKLCH lands on the same hex.
for (const hex of ['#E4B062', '#D0643B', '#0E0D0C', '#FFFFFF', '#3FB0A2']) {
  const { l, c, h } = toLch(hex);
  assert.equal(fromLch(l, c, h), hex, hex);
}

// No tint is Back Bar as it is.
assert.deepEqual(neutralsFor('dark', null), backbar.dark);
assert.deepEqual(neutralsFor('light', undefined), backbar.light);

// Neutral saves nothing, a grey colour can't tint, and the tints round-trip.
assert.equal(groundTintFor('#E4B062', 'neutral'), null);
assert.equal(groundTintFor('#808080', 'rich'), null);
for (const p of PALETTES) {
  for (const g of ['hint', 'rich'] as const) {
    const tint = groundTintFor(p.accent, g);
    assert.ok(tint && usableGroundTint(tint), `${p.name} ${g} is a usable tint`);
    assert.equal(groundOf(p.accent, tint), g);
  }
  assert.equal(groundOf(p.accent, null), 'neutral');
}
// An older tint (Plum, from the five presets) is none of the three.
assert.equal(groundOf('#E4B062', '#181019'), null);

// Text reads on every ground and card the system makes, old presets included.
const tints = [...PALETTES.flatMap((p) => [groundTintFor(p.accent, 'hint'), groundTintFor(p.accent, 'rich')]), '#1A1410', '#0F1812', '#0F131C', '#181019'];
for (const tint of tints) {
  for (const scheme of ['dark', 'light'] as const) {
    const c = neutralsFor(scheme, tint);
    for (const bg of [c.ground, c.surface, c.raised]) {
      assert.ok(contrast(c.ink, bg) >= 7, `${scheme} ink on ${bg} (${tint})`);
      assert.ok(contrast(c.muted, bg) >= 4.5, `${scheme} muted on ${bg} (${tint}): ${contrast(c.muted, bg).toFixed(2)}`);
    }
  }
}

// Any tint the app accepts, however it was saved (SQL, a seed), keeps text readable on its cards.
let swept = 0;
for (let r = 0; r < 256; r += 12) for (let g = 0; g < 256; g += 12) for (let b = 0; b < 256; b += 12) {
  const tint = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  if (!usableGroundTint(tint)) continue;
  swept++;
  for (const scheme of ['dark', 'light'] as const) {
    const c = neutralsFor(scheme, tint);
    for (const bg of [c.ground, c.surface, c.raised]) {
      assert.ok(contrast(c.ink, bg) >= 7, `${scheme} ink on ${bg} (${tint})`);
      assert.ok(contrast(c.muted, bg) >= 4.5, `${scheme} muted on ${bg} (${tint}): ${contrast(c.muted, bg).toFixed(2)}`);
    }
  }
}
assert.ok(swept > 500, `swept ${swept} usable tints`);

// The dark ground is the saved tint itself.
assert.equal(neutralsFor('dark', '#181019').ground, '#181019');

// Logo colours come first, then the standard palettes, six in all, no repeats.
const named = palettesFor(['#d0643b', '#123456'], () => 'Logo');
assert.equal(named.length, 6);
assert.deepEqual(named.slice(0, 2).map((p) => p.accent), ['#D0643B', '#123456']);
assert.equal(new Set(named.map((p) => p.accent)).size, 6);
assert.equal(palettesFor([], (h) => h).length, 6);

// Notes only when a mode shifts the colour: amber is deepened for light mode only.
assert.deepEqual(shadeNotes('#E4B062', null, 'Amber'), ['Light mode uses a deeper amber for text, so it stays readable.']);
assert.deepEqual(shadeNotes('#4F8FE0', groundTintFor('#4F8FE0', 'hint'), 'Blue'), ['Light mode uses a deeper blue for text, so it stays readable.']);

console.log('palette checks passed');
