// Checks for lib/sky.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { drinkSky, hexToOklch, oklchToHex } from './sky';

// Round trip through OKLCH stays within a step of the original.
for (const hex of ['#CAA26B', '#9F363B', '#8F887E', '#D2D4AD', '#000000', '#FFFFFF']) {
  const back = oklchToHex(hexToOklch(hex));
  const diff = [1, 3, 5].map((i) => Math.abs(parseInt(hex.slice(i, i + 2), 16) - parseInt(back.slice(i, i + 2), 16)));
  assert.ok(Math.max(...diff) <= 1, `${hex} came back as ${back}`);
}

// The Penicillin's light sky is a breath: very light at the top, ending on the ground.
const pen = drinkSky('#caa26b', 'light', '#F6F3EE');
assert.equal(pen.colors[2], '#F6F3EE');
assert.deepEqual(pen.stops, [0, 170, 330]);
assert.ok(hexToOklch(pen.colors[0]).L > 0.94, 'light top stays light');
assert.ok(Math.abs(hexToOklch(pen.colors[0]).H - hexToOklch('#caa26b').H) < 3, 'keeps the drink hue');

// A clear drink (a Martini) is an icy blue, not grey.
const martini = hexToOklch(drinkSky('#8F887E', 'light', '#F6F3EE').colors[0]);
assert.ok(martini.H > 200 && martini.H < 260, `icy hue, got ${martini.H}`);

// Dark: near-black with the drink's colour, reaching further; desktop stretches it.
const night = drinkSky('#9f363b', 'dark', '#0E0D0C', true);
assert.ok(hexToOklch(night.colors[0]).L < 0.3);
assert.deepEqual(night.stops, [0, 265, 558]);

// No colour yet: still a sky, never a crash.
assert.equal(drinkSky(null, 'light', '#F6F3EE').colors.length, 3);
