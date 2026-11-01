// Checks where the Colour sheet's pins go on a logo (lib/logoPins.ts).
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { logoRect, mergeLogoColours, pinsFromPixels } from './logoPins';

const RUST = '#D0643B';
const PINE = '#2F4A3A';
const CREAM = '#EFE4CE';
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Little Rye's mark as the canvas draws it (Theme-set, a 100 unit square):
// a pine ring, a rust disc, a cream stalk and ears, clear around the outside.
function littleRye(side: number) {
  const px = new Uint8ClampedArray(side * side * 4);
  const ellipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    const [dx, dy] = [x - cx, y - cy];
    const [u, v] = [dx * Math.cos(a) + dy * Math.sin(a), -dx * Math.sin(a) + dy * Math.cos(a)];
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
  };
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const [x, y] = [((i + 0.5) / side) * 100, ((j + 0.5) / side) * 100];
      const r = Math.hypot(x - 50, y - 50);
      const ears = [[43, 33, -32], [57, 33, 32], [43, 46, -32], [57, 46, 32]].some(([cx, cy, deg]) => ellipse(x, y, cx, cy, 4.2, 8, deg));
      const wheat = (Math.abs(x - 50) <= 1.6 && y >= 24 && y <= 84) || ellipse(x, y, 50, 21, 4, 7.5, 0) || ears;
      const colour = r > 50 ? null : r > 45 ? PINE : wheat ? CREAM : RUST;
      if (!colour) continue;
      px.set([...rgb(colour), 255], (j * side + i) * 4);
    }
  }
  return px;
}

const SIDE = 64;
const pins = pinsFromPixels(littleRye(SIDE), SIDE, SIDE, [RUST, PINE, CREAM, '#4F8FE0']);
const at = Object.fromEntries(pins.map((p) => [p.hex, p]));
const fromMiddle = (p: { x: number; y: number }) => Math.hypot(p.x - 0.5, p.y - 0.5);

// A colour the logo doesn't have gets no pin; the three it has get one each.
assert.deepEqual(pins.map((p) => p.hex), [RUST, PINE, CREAM]);
// Pine sits on the ring, not at its average (the middle of the logo).
assert.ok(fromMiddle(at[PINE]) > 0.44 && fromMiddle(at[PINE]) < 0.5, `pine on the ring (${fromMiddle(at[PINE]).toFixed(2)})`);
// Rust sits on the disc, clear of the ring and of the stalk.
assert.ok(fromMiddle(at[RUST]) < 0.42 && Math.abs(at[RUST].x - 0.5) > 0.1, `rust on the disc (${at[RUST].x.toFixed(2)}, ${at[RUST].y.toFixed(2)})`);
// Cream sits on the wheat: near the stalk, in its upper half where the ears are.
assert.ok(Math.abs(at[CREAM].x - 0.5) < 0.1 && at[CREAM].y < 0.55, `cream on the wheat (${at[CREAM].x.toFixed(2)}, ${at[CREAM].y.toFixed(2)})`);
// Each pin's own pixel is its colour.
const image = littleRye(SIDE);
for (const p of pins) {
  const i = (Math.floor(p.y * SIDE) * SIDE + Math.floor(p.x * SIDE)) * 4;
  assert.deepEqual([...image.slice(i, i + 3)], rgb(p.hex), `${p.hex} pin on its own colour`);
}

// A shade a little off (a JPEG's, a soft edge) still counts as the colour.
const soft = new Uint8ClampedArray(4 * 4 * 4).fill(255);
for (let p = 0; p < 16; p++) soft.set([200, 105, 65, 255], p * 4);
assert.equal(pinsFromPixels(soft, 4, 4, [RUST]).length, 1);
// Clear pixels are background, whatever colour they carry.
const clear = new Uint8ClampedArray(4 * 4 * 4);
for (let p = 0; p < 16; p++) clear.set([...rgb(RUST), 0], p * 4);
assert.deepEqual(pinsFromPixels(clear, 4, 4, [RUST]), []);

// Where the image sits in its LogoImage tile.
assert.deepEqual(logoRect('clear', 180, 1), { left: 0, top: 0, width: 180, height: 180 });
assert.deepEqual(logoRect('solid', 180, 1), { left: 18, top: 18, width: 144, height: 144 });
// A wide transparent logo is fitted; a wide busy one fills and is cropped.
assert.deepEqual(logoRect('clear', 100, 2), { left: 0, top: 25, width: 100, height: 50 });
assert.deepEqual(logoRect('busy', 100, 2), { left: -50, top: 0, width: 200, height: 100 });
assert.deepEqual(logoRect(null, 100, 0.5), { left: 0, top: -50, width: 100, height: 200 });

// The colours offered: known first, then what the pixels show, no near repeats, at most three.
assert.deepEqual(mergeLogoColours(['#2f4a3a'], ['#D0643B', '#2E4B3B']), [PINE, RUST]);
assert.deepEqual(mergeLogoColours([RUST], [PINE, CREAM, '#4F8FE0']), [RUST, PINE, CREAM]);

console.log('logoPins: each colour pinned where it sits in the logo');
