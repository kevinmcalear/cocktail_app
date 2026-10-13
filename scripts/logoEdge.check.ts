import assert from 'node:assert/strict';

import {
  logoEdge,
  logoEdgeFromUrl,
  logoFileTag,
  logoWithBackground,
  noBackgroundPath,
  removeLogoBackground,
} from '../supabase/functions/_shared/logoEdge';

// A logo's edge and its background removal (supabase/functions/_shared/logoEdge.ts),
// on small drawn logos: what upload-bar-logo stores and what the app draws.

type Rgba = [number, number, number, number];
const SIZE = 40;
const WHITE: Rgba = [255, 255, 255, 255];
const BLACK: Rgba = [0, 0, 0, 255];
const INK: Rgba = [24, 40, 70, 255];
const GOLD: Rgba = [214, 170, 80, 255];
const CLEAR: Rgba = [0, 0, 0, 0];

/** A SIZE x SIZE logo: `paint(x, y)` says each pixel's colour. */
function logo(paint: (x: number, y: number) => Rgba): Uint8Array {
  const px = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) px.set(paint(x, y), (y * SIZE + x) * 4);
  return px;
}
const at = (px: Uint8Array, x: number, y: number) => Array.from(px.subarray((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 4));
const alpha = (px: Uint8Array, x: number, y: number) => px[(y * SIZE + x) * 4 + 3];
const ring = (x: number, y: number, outer: number, inner = 0) => {
  const r = Math.hypot(x - 19.5, y - 19.5);
  return r <= outer && r >= inner;
};
/** JPEG-ish noise: a background a few steps off pure. */
const noisy = (c: Rgba, x: number, y: number): Rgba => [c[0] - ((x * 7 + y * 3) % 6), c[1] - ((x * 5 + y) % 5), c[2] - ((x + y * 11) % 7), 255];

// 1. A dark badge on white paper (with JPEG noise): white edge, cut out, badge kept.
{
  const px = logo((x, y) => (ring(x, y, 14) ? INK : noisy(WHITE, x, y)));
  const edge = logoEdge(px, SIZE, SIZE);
  assert.equal(edge.kind, 'solid');
  assert.ok(edge.kind === 'solid' && edge.color >= '#f8f8f8', `white paper, got ${JSON.stringify(edge)}`);
  assert.equal(removeLogoBackground(px, SIZE, SIZE), true);
  assert.equal(alpha(px, 0, 0), 0, 'corner gone');
  assert.equal(alpha(px, 39, 20), 0, 'edge gone');
  assert.deepEqual(at(px, 20, 20), [...INK], 'the badge stays as it was');
  assert.equal(logoEdge(px, SIZE, SIZE).kind, 'clear', 'now transparent at the edge');
}

// 2. Gold type on black: black edge, cut out the same way.
{
  const px = logo((x, y) => (x > 8 && x < 32 && y > 15 && y < 25 && x % 4 < 2 ? GOLD : BLACK));
  const edge = logoEdge(px, SIZE, SIZE);
  assert.deepEqual(edge, { kind: 'solid', color: '#000000' });
  assert.equal(removeLogoBackground(px, SIZE, SIZE), true);
  assert.equal(alpha(px, 0, 0), 0);
  assert.equal(alpha(px, 10, 10), 0, 'between the letters, reached from the edge');
  assert.deepEqual(at(px, 9, 20), [...GOLD], 'a letter stays');
}

// 3. A white hole inside the mark (a ring's middle), not touching the edge, stays white and solid.
{
  const px = logo((x, y) => (ring(x, y, 7) ? WHITE : ring(x, y, 15) ? INK : WHITE));
  assert.equal(removeLogoBackground(px, SIZE, SIZE), true);
  assert.equal(alpha(px, 0, 0), 0, 'the paper goes');
  assert.deepEqual(at(px, 20, 20), [...WHITE], 'the hole stays');
}

// 3b. A letter's counter (a hole as small as the one in an O) goes with the paper, or it shows as a white speck on the dark ground.
{
  const px = logo((x, y) => (x >= 18 && x <= 19 && y >= 18 && y <= 19 ? WHITE : x >= 14 && x <= 23 && y >= 14 && y <= 23 ? INK : WHITE));
  assert.equal(removeLogoBackground(px, SIZE, SIZE), true);
  assert.equal(alpha(px, 18, 18), 0, 'the counter goes');
  assert.equal(alpha(px, 15, 15), 255, 'the letter stays');
}

// 3c. Cream type inside a navy badge on white is near the paper's colour but isn't it: it stays.
{
  const cream: Rgba = [240, 232, 220, 255];
  const px = logo((x, y) => (x >= 18 && x <= 21 && y >= 18 && y <= 21 ? cream : ring(x, y, 15) ? INK : WHITE));
  assert.equal(removeLogoBackground(px, SIZE, SIZE), true);
  assert.equal(alpha(px, 19, 19), 255, 'the type stays');
}

// 4. Already transparent: clear, and nothing to remove.
{
  const px = logo((x, y) => (ring(x, y, 12) ? GOLD : CLEAR));
  assert.deepEqual(logoEdge(px, SIZE, SIZE), { kind: 'clear' });
  const before = px.slice();
  assert.equal(removeLogoBackground(px, SIZE, SIZE), false);
  assert.deepEqual(px, before, 'untouched');
}

// 5. A photo to the edge: busy, nothing removed, drawn filling its tile.
{
  const px = logo((x, y) => [(x * 37) % 256, (y * 53) % 256, ((x + y) * 29) % 256, 255]);
  assert.deepEqual(logoEdge(px, SIZE, SIZE), { kind: 'busy' });
  assert.equal(removeLogoBackground(px, SIZE, SIZE), false);
}

// 6. The soft edge: a half-ink pixel beside the paper keeps half its alpha and loses the white in it.
{
  const half: Rgba = [140, 148, 163, 255]; // INK half over white
  const px = logo((x, y) => (x >= 14 && x <= 25 && y >= 14 && y <= 25 ? INK : x === 13 && y >= 14 && y <= 25 ? half : WHITE));
  assert.equal(removeLogoBackground(px, SIZE, SIZE), true);
  const [r, g, b, a] = at(px, 13, 20);
  assert.ok(a > 100 && a < 155, `half alpha, got ${a}`);
  assert.ok(Math.abs(r - INK[0]) <= 3 && Math.abs(g - INK[1]) <= 3 && Math.abs(b - INK[2]) <= 3, `ink colour, got ${[r, g, b]}`);
}

// File names carry the edge, both ways.
for (const edge of [{ kind: 'clear' }, { kind: 'busy' }, { kind: 'solid', color: '#0a1b2c' }] as const) {
  assert.deepEqual(logoEdgeFromUrl(`https://x.supabase.co/storage/v1/object/public/drinks/bars/b/1700.${logoFileTag(edge)}.png`), edge);
}
assert.equal(logoEdgeFromUrl('https://x.supabase.co/storage/v1/object/public/drinks/bars/b/1700.png'), null, 'older uploads are unknown');
assert.equal(logoEdgeFromUrl('https://example.com/logo.png?v=2'), null);
assert.equal(noBackgroundPath('bars/b/1700.effffff.png'), 'bars/b/1700.effffff.nobg.png');
assert.deepEqual(logoEdgeFromUrl('https://h/drinks/bars/b/1700.effffff.nobg.png'), { kind: 'clear' });
assert.equal(logoWithBackground('https://h/drinks/bars/b/1700.effffff.nobg.png'), 'https://h/drinks/bars/b/1700.effffff.png');
assert.equal(logoWithBackground('https://h/drinks/bars/b/1700.nobg.png?t=1'), 'https://h/drinks/bars/b/1700.png?t=1');
assert.equal(logoWithBackground('https://h/drinks/bars/b/1700.effffff.png'), null);

console.log('logoEdge: ok');
