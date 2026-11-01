// Checks for lib/theme.ts: the guard rails as drawn (canvas GWBCX "themes").
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { BAR_COLOURS, DEFAULT_ACCENT } from '@/constants/tokens';

import { groundTintFor, neutralsFor, toLch } from './palette';
import { isGrey, notForButton, themeColours, themeFor } from './theme';

const canvas = { Rust: '#D0643B', Lavender: '#B9A8F5', 'Neon green': '#39FF14', Ink: '#1E1B17' };
const seeds: [string, string][] = [...Object.entries(canvas), ['Amber', DEFAULT_ACCENT], ...BAR_COLOURS.map((c): [string, string] => [c.name, c.hex])];

// Every label and every text shade reads at 4.5:1, on every ground a bar can pick, in both modes.
for (const [name, hex] of seeds) {
  for (const g of ['neutral', 'hint', 'rich'] as const) {
    const tint = groundTintFor(hex, g);
    for (const dark of [false, true]) {
      const ground = neutralsFor(dark ? 'dark' : 'light', tint).ground;
      const t = themeColours(hex, ground, dark, name);
      const where = `${name} ${g} ${dark ? 'dark' : 'light'}`;
      assert.ok(t.fillRatio >= 4.5, `${where}: label ${t.fillRatio.toFixed(2)}`);
      assert.ok(t.textRatio >= 4.5, `${where}: text ${t.textRatio.toFixed(2)}`);
      // The button keeps at most the neon cap of chroma.
      if (!isGrey(hex)) assert.ok(toLch(t.fill).c <= 0.205, `${where}: chroma ${toLch(t.fill).c.toFixed(3)}`);
    }
  }
}

// Rust on the paper, as the canvas draws it: the button stands off the page.
const rust = themeFor('#D0643B', groundTintFor('#D0643B', 'hint'), 'Rust');
assert.ok(rust.light.offPage >= 2, `rust off the paper ${rust.light.offPage.toFixed(2)}`);

// Neon is toned down, and says so.
const neon = themeFor('#39FF14', groundTintFor('#39FF14', 'rich'), 'Neon green');
assert.ok(neon.notes.some((n) => n.startsWith('Toned down: Neon green')), neon.notes.join(' | '));
assert.ok(neon.light.offPage >= 2, `neon off the paper ${neon.light.offPage.toFixed(2)}`);

// Lavender is pale: deepened on paper so the button shows.
const moth = themeFor('#B9A8F5', groundTintFor('#B9A8F5', 'rich'), 'Lavender');
assert.ok(moth.light.offPage >= 2, `lavender off the paper ${moth.light.offPage.toFixed(2)}`);

// A black and white logo: ink buttons on paper, cream at night.
const ink = themeFor('#1E1B17', null, 'Ink');
assert.ok(isGrey('#1E1B17'));
assert.ok(toLch(ink.light.fill).l < 0.3 && toLch(ink.dark.fill).l > 0.9);

// A navy that's smart on paper is lifted at night until the button shows.
const navy = themeFor('#1F2D4A', null, 'Ink navy');
assert.ok(navy.dark.notes.some((n) => n.startsWith('Lifted a step')), navy.dark.notes.join(' | '));

// Something is always said under the picker: what moved, or that nothing had to.
assert.ok(themeFor('#B87333', groundTintFor('#B87333', 'hint'), 'Copper').notes.length >= 1);

// Logo colours that can't be a button say why; greys can (ink buttons).
assert.equal(notForButton('#EFE4CE'), 'Too pale for a button');
assert.equal(notForButton('#FFFFFF'), 'Too pale for a button');
assert.equal(notForButton('#120616'), 'Too dark for a button');
assert.equal(notForButton('#0B0B0B'), null);
assert.equal(notForButton('#D0643B'), null);

console.log('theme checks passed');
