import assert from 'node:assert/strict';

import { holdsMl, resizeOutline, traceGlass, type TracePixels } from './glassTrace';
import { readOutline } from './sketch/outline';

// Photos drawn here: a wall with a soft gradient and a little noise, and a
// glass drawn the way a phone sees clear glass, darker at its edges, its rim
// and its base, and nearly see-through between them. Profiles are [depth below the rim, diameter] in mm.
type Profile = [number, number][];
const coupe: Profile = [
  [0, 90],
  [10, 93],
  [30, 70],
  [45, 12],
  [47, 8],
  [138, 8],
  [140, 20],
  [146, 60],
  [150, 70],
];
const rocks: Profile = [
  [0, 80],
  [45, 78],
  [85, 74],
  [90, 74],
];

const widthAt = (p: Profile, d: number) => {
  for (let i = 1; i < p.length; i++) if (d <= p[i][0]) return p[i - 1][1] + ((p[i][1] - p[i - 1][1]) * (d - p[i - 1][0])) / (p[i][0] - p[i - 1][0] || 1);
  return p[p.length - 1][1];
};

let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 6;

function photo(glasses: { p: Profile; cx: number; top: number; pxPerMm: number }[], opts: { W?: number; H?: number; busy?: boolean } = {}): TracePixels {
  const W = opts.W ?? 600;
  const H = opts.H ?? 800;
  const lum = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lum[y * W + x] = 175 + (x / W) * 25 + (y / H) * 10 + noise();
  if (opts.busy) for (let y = 0; y < H; y += 40) for (let x = 0; x < 40; x++) for (let k = 0; k < 20; k++) lum[(y + k) * W + x] = 60;
  for (const g of glasses) {
    const height = g.p[g.p.length - 1][0];
    const end = Math.min(H, g.top + height * g.pxPerMm);
    for (let y = Math.round(g.top); y < end; y++) {
      const half = (widthAt(g.p, (y - g.top) / g.pxPerMm) / 2) * g.pxPerMm;
      for (let x = Math.max(0, Math.round(g.cx - half)); x <= Math.min(W - 1, Math.round(g.cx + half)); x++) {
        const fromEdge = Math.min(x - (g.cx - half), g.cx + half - x);
        lum[y * W + x] -= fromEdge < 3 || y - g.top < 3 || end - y <= 3 ? 70 : 6;
      }
    }
  }
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let i = 0; i < W * H; i++) data.fill(lum[i], i * 4, i * 4 + 3);
  return { width: W, height: H, data };
}

const near = (got: number, want: number, within: number, what: string) => assert.ok(Math.abs(got - want) <= want * within, `${what}: ${got} vs ${want}`);

// A coupe, sized by its height.
const shot = photo([{ p: coupe, cx: 300, top: 120, pxPerMm: 3.7 }]);
const traced = traceGlass(shot, { height_mm: 150 });
assert.ok(traced.ok, `the coupe traces: ${!traced.ok && traced.why}`);
const o = traced.glass.outline;
near(o.height_mm, 150, 0.01, 'height');
near(o.rim_mm, 90, 0.05, 'rim');
near(o.widest_mm, 93, 0.05, 'widest');
assert.equal(o.stemmed, true);
near(o.bowl_mm!, 45, 0.15, 'bowl depth');
near(o.foot_mm!, 70, 0.1, 'foot');
assert.ok(readOutline(o), 'the painter can draw it');
assert.equal('frame' in o, false, 'where it sat in the photo isn’t stored');

// The traced line lies on the photo, left of the right side, within the frame.
const { left, right } = traced.glass.overlay;
assert.equal(left.length, right.length);
for (let i = 0; i < left.length; i++) {
  assert.ok(left[i][0] <= right[i][0] && left[i][0] >= 0 && right[i][0] <= 1 && left[i][1] >= 0 && left[i][1] <= 1);
}
near(right[0][0] - left[0][0], (90 * 3.7) / 600, 0.06, 'the rim on the photo');

// Sized by its capacity instead, it comes out the same height; Fix the height scales the same shape.
const holds = holdsMl(o);
const byCapacity = traceGlass(shot, { capacity_ml: holds });
assert.ok(byCapacity.ok);
near(byCapacity.glass.outline.height_mm, 150, 0.01, 'height from capacity');
const taller = resizeOutline(o, { height_mm: 165 });
near(taller.height_mm, 165, 0.001, 'fixed height');
near(taller.rim_mm, o.rim_mm * 1.1, 0.01, 'the rim grows with it');
near(holdsMl(resizeOutline(o, { capacity_ml: holds * 2 })), holds * 2, 0.02, 'fixed capacity');

// A rocks glass: no stem.
const tumbler = traceGlass(photo([{ p: rocks, cx: 280, top: 200, pxPerMm: 5 }]), { height_mm: 90 });
assert.ok(tumbler.ok && !tumbler.glass.outline.stemmed);
assert.ok(tumbler.ok && Math.abs(tumbler.glass.outline.rim_mm - 80) < 4);

// It stops, and says why, rather than guess.
const why = (p: TracePixels) => {
  const r = traceGlass(p, { height_mm: 100 });
  return r.ok ? 'traced' : r.why;
};
assert.equal(
  why(
    photo([
      { p: rocks, cx: 150, top: 200, pxPerMm: 3 },
      { p: coupe, cx: 450, top: 150, pxPerMm: 2.8 },
    ]),
  ),
  'several',
);
assert.equal(why(photo([{ p: coupe, cx: 300, top: 300, pxPerMm: 3.7 }])), 'cut');
assert.equal(why(photo([{ p: coupe, cx: 300, top: 120, pxPerMm: 3.7 }], { busy: true })), 'edge');
assert.equal(why(photo([{ p: rocks, cx: 300, top: 350, pxPerMm: 1 }])), 'small');
assert.equal(why(photo([])), 'edge');

// A big phone photo is read at a few hundred rows, and traces the same.
const big = traceGlass(photo([{ p: coupe, cx: 900, top: 360, pxPerMm: 11.1 }], { W: 1800, H: 2400 }), { height_mm: 150 });
assert.ok(big.ok, `the big photo traces: ${!big.ok && big.why}`);
near(big.glass.outline.rim_mm, 90, 0.05, 'rim from a big photo');

console.log('glassTrace ok');
