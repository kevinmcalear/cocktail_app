import assert from 'node:assert/strict';

import { pickPalette, toHsl } from '../supabase/functions/_shared/palette';

// The drink-field palette (supabase/functions/_shared/palette.ts) must find the
// drink, not the bar or the paper behind it.

type Rgb = [number, number, number];

/**
 * A 100x100 picture painted from [colour, share, alpha?] parts, the first part
 * in the middle and each next one in a ring around it, like a hero shot.
 */
function picture(parts: [Rgb, number, number?][]): Uint8Array {
  const pixels = new Uint8Array(100 * 100 * 4);
  const byDistance = Array.from({ length: 10_000 }, (_, p) => p).sort(
    (a, b) => Math.hypot((a % 100) - 49.5, Math.floor(a / 100) - 49.5) - Math.hypot((b % 100) - 49.5, Math.floor(b / 100) - 49.5)
  );
  let next = 0;
  for (const [[r, g, b], share, alpha = 255] of parts) {
    const end = Math.round(next + share * 10_000);
    for (; next < end; next++) pixels.set([r, g, b, alpha], byDistance[next] * 4);
  }
  return pixels;
}

const palette = (pixels: Uint8Array) => pickPalette(pixels, 100);

function hue(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return toHsl([(n >> 16) & 255, (n >> 8) & 255, n & 255]).h;
}

function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return toHsl([(n >> 16) & 255, (n >> 8) & 255, n & 255]).l;
}

function near(actual: number, expected: number, tolerance: number, label: string) {
  const d = Math.abs(actual - expected) % 360;
  assert.ok(Math.min(d, 360 - d) <= tolerance, `${label}: hue ${actual.toFixed(0)}, expected about ${expected}`);
}

function assertShape(palette: string[]) {
  assert.equal(palette.length, 3);
  for (const hex of palette) assert.match(hex, /^#[0-9a-f]{6}$/);
  const [dominant, deep, light] = palette.map(lightness);
  assert.ok(deep < dominant && dominant < light, `deep < dominant < light, got ${palette.join(' ')}`);
  assert.ok(deep <= 0.32, `deep is deep: ${palette[1]}`);
  assert.ok(light >= 0.8, `light is light: ${palette[2]}`);
}

// A red drink on a dark wood bar: the wood is more common, the drink wins.
const negroni = palette(picture([[[176, 40, 40], 0.25], [[80, 56, 32], 0.6], [[20, 18, 16], 0.15]]));
assertShape(negroni);
near(hue(negroni[0]), 0, 10, 'negroni dominant');

// A generated sketch: light paper, grey pencil, a little orange liquid.
const sketch = palette(picture([[[230, 126, 34], 0.05], [[120, 120, 118], 0.1], [[242, 238, 228], 0.85]]));
assertShape(sketch);
near(hue(sketch[0]), 28, 10, 'sketch dominant');

// A green drink in the middle of a big, warm room: the drink wins.
const midori = palette(picture([[[60, 200, 60], 0.12], [[196, 150, 90], 0.88]]));
assertShape(midori);
near(hue(midori[0]), 120, 10, 'midori dominant');

// Lots of amber liquid beats a small green garnish.
const oldFashioned = palette(picture([[[212, 160, 23], 0.4], [[46, 139, 87], 0.03], [[10, 10, 10], 0.57]]));
assertShape(oldFashioned);
near(hue(oldFashioned[0]), 44, 10, 'amber dominant');

// A companion taken from the picture: a deep red in the same drink stays red.
const layered = palette(picture([[[190, 50, 50], 0.5], [[90, 15, 20], 0.3], [[245, 245, 245], 0.2]]));
assertShape(layered);
near(hue(layered[1]), 356, 15, 'layered deep');

// A dark wine: the plum is the drink, not the bright rust rim where the light
// comes through, even though the rim is more vivid.
const shiraz = palette(picture([[[60, 20, 45], 0.5], [[140, 45, 12], 0.1], [[248, 246, 244], 0.4]]));
assertShape(shiraz);
near(hue(shiraz[0]), 322, 15, 'shiraz dominant');
assert.ok(lightness(shiraz[0]) < 0.3, `shiraz dominant is dark: ${shiraz[0]}`);

// A lighter red with some dark shading keeps its red body.
const houseRed = palette(picture([[[130, 35, 45], 0.4], [[70, 10, 15], 0.1], [[248, 246, 244], 0.5]]));
assertShape(houseRed);
assert.ok(lightness(houseRed[0]) > 0.3, `house red keeps its body: ${houseRed[0]}`);

// Transparent pixels are ignored, even when they're colourful.
const cutout = palette(picture([[[0, 200, 0], 0.7, 0], [[40, 90, 200], 0.3]]));
assertShape(cutout);
near(hue(cutout[0]), 222, 10, 'cutout dominant');

// A pencil sketch with a faint wash of pink wine still gets a pink field.
const wash = palette(picture([[[80, 80, 80], 0.08], [[222, 200, 204], 0.02], [[244, 244, 242], 0.9]]));
assertShape(wash);
near(hue(wash[0]), 350, 15, 'wash dominant');

// Greyscale: nothing to paint, so no palette. JPEG-ish noise doesn't count.
assert.deepEqual(palette(picture([[[244, 242, 240], 0.9], [[80, 80, 80], 0.1]])), []);
assert.deepEqual(palette(picture([[[245, 245, 245], 0.7], [[90, 90, 90], 0.3]])), []);
assert.deepEqual(palette(new Uint8Array(0)), []);

console.log('palette.check: ok');
