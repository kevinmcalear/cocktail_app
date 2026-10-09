// Ingredients that don't come in a bottle, drawn as small still lifes in the
// same hand as the drinks and bottles: citrus with a cut half, fruit, berries,
// a sprig of herbs, a dish of spice or beans, eggs, a flower, chocolate,
// mushrooms, roots and truffles, onions and garlic, seaweed, a wedge of cheese.

import { PANTRY } from '@/constants/pantry';
import { SKETCH } from '@/constants/sketch';
import { drawBottle, handFor } from './bottle';
import { ell, GLASS_SHAPES, type Pt } from './geometry';
import { makePainter, type Painter } from './painter';
import { gauss, hashString, mixHex, rng, type Rng } from './random';
import { SceneBuilder, type Scene } from './scene';
import { LIFT } from './styles';

export const PRODUCE_KINDS = ['citrus', 'fruit', 'berries', 'long', 'sprig', 'heap', 'egg', 'flower', 'bar', 'mushroom', 'root', 'bulb', 'seaweed', 'wedge'] as const;
export type ProduceKind = (typeof PRODUCE_KINDS)[number];
export type Grain = 'crystal' | 'powder' | 'bean' | 'nut' | 'leaf' | 'stick';

export interface ProduceInputs {
  kind: ProduceKind;
  color: string;
  /** Citrus flesh, a leaf, or a flower's centre. */
  accent?: string | null;
  /** What's in the dish (heap). */
  grain?: Grain;
  /** Sprig leaves: broad like mint, or needles like rosemary. */
  leaf?: 'broad' | 'narrow';
  /** Round (blueberry, cherry), drupelets (raspberry, blackberry), or strawberry. */
  berry?: 'round' | 'drupe' | 'strawberry';
  /** A cut slice in front (cucumber). */
  cut?: boolean;
  /** A little bottle of oil behind: a fat wash. */
  oil?: boolean;
  /** Mushrooms: a domed cap (porcini, shiitake) or a frilled funnel (chanterelle). */
  cap?: 'dome' | 'funnel';
  /** Roots: smooth tubers, or a warty truffle with a shaved slice. */
  rough?: boolean;
  /** Bulbs: an onion with a cut half, a head of garlic with a loose clove, or spring onions. */
  bulb?: 'onion' | 'garlic' | 'scallion';
}

const LEAF = PANTRY.leaf;
const DISH = PANTRY.dish;
const GROUND = 86;

export const oval = (cx: number, cy: number, rx: number, ry: number, rot = 0, n = 28): Pt[] => ell(cx, cy, rx, ry, 0, Math.PI * 2, n, rot).slice(0, n);
export const closed = (p: Pt[]): Pt[] => [...p, p[0]];
export const shade = (c: string) => mixHex(c, SKETCH.pool, 0.3);

export function shadow(P: Painter, r: Rng, cx: number, w: number, y = GROUND) {
  P.soft(cx + w * 0.2, y + 1, w * 1.2, 3.4, 0, P.S.ink, 0.1 * P.S.shadow);
  for (let i = 0; i < Math.round(5 + 8 * P.S.shadow); i++) {
    const yy = y + 0.4 + r() * 2.2;
    P.line([[cx - w * (0.5 + r() * 0.4), yy], [cx + w * (0.8 + r() * 0.7), yy + gauss(r) * 0.3]], { passes: 1, alpha: 0.3 * P.S.shadow, weight: 0.45, wob: 0.4, gaps: 0.3, over: 4 });
  }
}

/** A round thing with a soft highlight and a darker side. */
export function ball(P: Painter, pts: Pt[], c: string, cx: number, cy: number, R: number, strength = 0.95) {
  P.wash(pts, c, strength, { n: 16 });
  P.wash(pts.filter(([x, y]) => x + y > cx + cy - R * 0.2), shade(c), strength * 0.35, { layers: 0.5, spill: 0, fadeAngle: Math.PI / 4, fadeTo: 0, blooms: 0, n: 12 });
  P.soft(cx - R * 0.35, cy - R * 0.38, R * 0.32, R * 0.22, -0.5, LIFT, 0.55);
}

function leafAt(P: Painter, x: number, y: number, len: number, wid: number, ang: number, c: string, thumb: boolean) {
  const pts: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push([t * len, Math.sin(t * Math.PI) * wid * (1 - t * 0.25)]);
  }
  for (let i = 11; i > 0; i--) pts.push([pts[i][0], -pts[i][1]]);
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const out = pts.map(([u, v]): Pt => [x + u * ca - v * sa, y + u * sa + v * ca]);
  P.wash(out, c, 0.95, { n: 10, blooms: 0 });
  P.line(closed(out), { weight: 0.7, wob: 0.7 });
  if (!thumb) P.line([[x, y], [x + len * 0.85 * ca, y + len * 0.85 * sa]], { weight: 0.4, alpha: 0.7, passes: 1, over: 0 });
}

function citrus(P: Painter, r: Rng, c: string, flesh: string, thumb: boolean) {
  const whole = oval(39, 55, 24, 21, -0.15);
  ball(P, whole, c, 39, 55, 22);
  P.dots(Array.from({ length: thumb ? 0 : 26 }, () => { const a = r() * Math.PI * 2; const d = Math.sqrt(r()) * 19; return [39 + Math.cos(a) * d, 55 + Math.sin(a) * d * 0.88, 0.25 + r() * 0.25] as [number, number, number]; }), shade(c), 0.35);
  P.line(closed(whole), { weight: 1.1 });
  P.line([[62, 50], [64.5, 48.5]], { weight: 0.9 });
  leafAt(P, 40, 35, 14, 4.2, -1.1, LEAF, thumb);
  // the cut half in front: skin dome, rind, flesh and segments
  const [hx, hy] = [64, 71];
  const dome = [...ell(hx, hy, 19, 13, 0, Math.PI, 18), ...ell(hx, hy, 19, 9.5, Math.PI, Math.PI * 2, 18)];
  P.wash(dome, shade(c), 0.9, { n: 14 });
  P.wash(oval(hx, hy, 19, 9.5), c, 0.9, { n: 14, blooms: 0 });
  P.wash(oval(hx, hy, 16.2, 7.8), flesh, 0.85, { n: 14, blooms: 0, spill: 0 });
  P.line(closed(oval(hx, hy, 16.4, 7.9)), { weight: 0.45, alpha: 0.7, passes: 1 });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + r() * 0.1;
    P.line([[hx + Math.cos(a) * 2, hy + Math.sin(a)], [hx + Math.cos(a) * 15.2, hy + Math.sin(a) * 7.3]], { weight: 0.4, alpha: 0.55, passes: 1, over: 0, gaps: 0.2 });
  }
  P.line(closed(oval(hx, hy, 19, 9.5)), { weight: 0.9 });
  P.line(ell(hx, hy, 19, 13, 0, Math.PI, 18), { weight: 1.1 });
  shadow(P, r, 52, 30);
}

function fruit(P: Painter, r: Rng, c: string, leaf: string, thumb: boolean) {
  const [cx, cy, R] = [50, 59, 25];
  const pts: Pt[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2 - Math.PI / 2;
    const dip = 1 - 0.1 * Math.exp(-(((a + Math.PI / 2) % (Math.PI * 2)) ** 2) / 0.05) - 0.1 * Math.exp(-((a - Math.PI * 1.5) ** 2) / 0.05);
    pts.push([cx + Math.cos(a) * R * dip * 1.04, cy + Math.sin(a) * R * dip * 0.96]);
  }
  ball(P, pts, c, cx, cy, R);
  P.line(closed(pts), { weight: 1.1 });
  P.line([[cx, cy - R + 3], [cx + 1.5, cy - R - 5]], { weight: 1.2 });
  leafAt(P, cx + 1.5, cy - R - 3, 13, 4.4, -0.45, leaf, thumb);
  shadow(P, r, cx, R);
}

function berries(P: Painter, r: Rng, c: string, style: 'round' | 'drupe' | 'strawberry', thumb: boolean) {
  if (style === 'strawberry') return strawberries(P, r, c, thumb);
  if (style === 'round') {
    const spots: [number, number, number][] = [[38, 72, 9], [56, 74, 9.5], [47, 60, 9], [66, 62, 8.5], [30, 60, 8], [57, 50, 8]];
    for (const [x, y, rad] of spots.sort((a, b) => a[1] - b[1])) {
      const p = oval(x, y, rad, rad * 0.92, r(), 18);
      ball(P, p, mixHex(c, SKETCH.pool, r() * 0.2), x, y, rad, 1);
      P.line(closed(p), { weight: 0.9 });
      // the little crown on top
      if (!thumb) for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; P.line([[x - rad * 0.25, y - rad * 0.3], [x - rad * 0.25 + Math.cos(a) * 1.6, y - rad * 0.3 + Math.sin(a) * 1.2]], { weight: 0.4, passes: 1, over: 0 }); }
    }
    shadow(P, r, 50, 28);
    return;
  }
  // raspberries: rounded thimbles made of drupelets, one showing its hollow end
  const spots: [number, number, number, number][] = [[34, 60, 13, -0.5], [62, 56, 12.5, 0.4], [48, 73, 13.5, 1.5]];
  for (const [i, [x, y, rad, rot]] of spots.entries()) {
    const out: Pt[] = [];
    for (let k = 0; k < 40; k++) {
      const t = (k / 40) * Math.PI * 2;
      const bump = 1 + 0.06 * Math.abs(Math.sin(t * 7));
      const u = rad * 0.86 * Math.cos(t) * bump;
      const v = rad * Math.sin(t) * bump;
      out.push([x + u * Math.cos(rot) - v * Math.sin(rot), y + u * Math.sin(rot) + v * Math.cos(rot)]);
    }
    ball(P, out, mixHex(c, SKETCH.pool, r() * 0.15), x, y, rad, 1.05);
    const cells: [number, number, number][] = [];
    for (let gy = -1; gy <= 1.01; gy += 0.3) {
      for (let gx = -1; gx <= 1.01; gx += 0.3) {
        const ox = gx + (Math.round(gy / 0.3) % 2 ? 0.15 : 0);
        if (ox * ox + gy * gy > 0.8) continue;
        const u = ox * rad * 0.72;
        const v = gy * rad * 0.9;
        cells.push([x + u * Math.cos(rot) - v * Math.sin(rot), y + u * Math.sin(rot) + v * Math.cos(rot), rad * 0.14]);
      }
    }
    if (!thumb) for (const [cx, cy, cr] of cells) if (r() < 0.75) P.line(closed(oval(cx, cy, cr * 1.15, cr, r(), 8)), { weight: 0.45, alpha: 0.7, passes: 1, over: 1, gaps: 0.6, wob: 1 });
    if (i === 2) {
      const [hx, hy] = [x - Math.sin(rot) * -rad * 0.95, y + Math.cos(rot) * -rad * 0.95];
      const hole = oval(hx, hy, rad * 0.38, rad * 0.24, rot, 12);
      P.wash(hole, mixHex(c, SKETCH.pool, 0.6), 1, { n: 8, blooms: 0, spill: 0, layers: 0.4 });
      P.line(closed(hole), { weight: 0.5, passes: 1 });
    }
    P.line(closed(out), { weight: 0.9 });
  }
  shadow(P, r, 50, 26);
}
function strawberries(P: Painter, r: Rng, c: string, thumb: boolean) {
  for (const [x, y, rad, rot] of [[38, 60, 13, -0.35], [62, 64, 12, 0.5]] as const) {
    const out: Pt[] = [];
    for (let k = 0; k < 32; k++) {
      const t = (k / 32) * Math.PI * 2;
      // broad shoulders tapering to a point
      const u = rad * Math.cos(t) * (1 - 0.55 * ((1 + Math.sin(t)) / 2) ** 1.4);
      const v = rad * 1.12 * Math.sin(t);
      out.push([x + u * Math.cos(rot) - v * Math.sin(rot), y + u * Math.sin(rot) + v * Math.cos(rot)]);
    }
    ball(P, out, c, x, y, rad, 1);
    if (!thumb) for (let i = 0; i < 18; i++) {
      const u = (r() * 2 - 1) * rad * 0.6;
      const v = (r() * 1.6 - 0.5) * rad * 0.8;
      const [sx, sy] = [x + u * Math.cos(rot) - v * Math.sin(rot), y + u * Math.sin(rot) + v * Math.cos(rot)];
      P.line([[sx, sy], [sx + 0.5, sy + 0.9]], { weight: 0.55, passes: 1, over: 0, wob: 0.2 });
    }
    P.line(closed(out), { weight: 0.95 });
    // the leafy cap
    const [tx, ty] = [x + Math.sin(rot) * rad * 1.05, y - Math.cos(rot) * rad * 1.05];
    for (let k = 0; k < 5; k++) leafAt(P, tx, ty, 6.5 + r() * 2, 2, rot - Math.PI / 2 + (k - 2) * 0.6 + gauss(r) * 0.1, LEAF, true);
    P.line([[tx, ty], [tx + Math.sin(rot) * 4, ty - Math.cos(rot) * 4]], { weight: 0.8, passes: 1 });
  }
  shadow(P, r, 50, 26);
}

function long(P: Painter, r: Rng, c: string, cut: boolean, thumb: boolean) {
  // a cucumber is blunt and lies back so its slice can sit in front
  const [x0, y0, x1, y1] = cut ? [18, 64, 72, 50] : [22, 72, 78, 58];
  const spine: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    spine.push([x0 + t * (x1 - x0), y0 + t * (y1 - y0) - Math.sin(t * Math.PI) * (cut ? 3 : 5)]);
  }
  const W = (t: number) => (cut ? 8.5 * Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** 5)) : 7.5 * Math.sqrt(Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) + 0.08));
  const top: Pt[] = [];
  const bottom: Pt[] = [];
  spine.forEach(([x, y], i) => {
    const t = i / 24;
    top.push([x + 0.25 * W(t), y - W(t)]);
    bottom.push([x - 0.25 * W(t), y + W(t)]);
  });
  const body = [...top, ...[...bottom].reverse()];
  const skin = cut ? mixHex(c, SKETCH.pool, 0.3) : c;
  P.wash(body, skin, 0.95, { n: 18 });
  P.wash(bottom, shade(skin), 0.45, { layers: 0.5, spill: 0, blooms: 0, fadeTo: 0 });
  if (cut) {
    // pale stripes and warty bumps down the skin
    for (const k of [-0.45, 0.1, 0.55]) P.wash(spine.slice(3, 22).map(([x, y], i) => [x, y + k * W((i + 3) / 24)] as Pt).concat(spine.slice(3, 22).reverse().map(([x, y], i) => [x, y + (k + 0.12) * W((21 - i) / 24)] as Pt)), mixHex(c, SKETCH.white, 0.35), 0.5, { n: 10, blooms: 0, spill: 0, layers: 0.4 });
    if (!thumb) P.dots(Array.from({ length: 34 }, () => { const t = 0.08 + r() * 0.84; const [x, y] = spine[Math.round(t * 24)]; return [x + gauss(r) * 0.5, y + (r() * 2 - 1) * W(t) * 0.85, 0.35 + r() * 0.3] as [number, number, number]; }), shade(skin), 0.55);
  } else if (!thumb) for (let k = -1; k <= 1; k++) P.line(spine.slice(2, 23).map(([x, y], i) => [x, y + k * W((i + 2) / 24) * 0.5] as Pt), { weight: 0.4, alpha: 0.45, passes: 1, gaps: 0.6 });
  P.line(closed(body), { weight: 1.05 });
  P.line([[x1, y1 - 1], [x1 + 4, y1 - 3.5]], { weight: 1 });
  if (cut) {
    // the slice: a thin disc with dark rind, pale flesh and a ring of seeds
    const [hx, hy] = [62, 74];
    P.wash([...ell(hx, hy, 13, 10.5, 0, Math.PI, 16), ...ell(hx, hy, 13, 8, Math.PI, Math.PI * 2, 16)], skin, 0.95, { n: 12, blooms: 0 });
    P.wash(oval(hx, hy, 13, 8), skin, 0.9, { n: 12, blooms: 0, spill: 0 });
    P.wash(oval(hx, hy, 11.4, 6.9), PANTRY.cucumberFlesh, 0.8, { n: 12, blooms: 0, spill: 0 });
    P.wash(oval(hx, hy, 6.4, 3.8), PANTRY.cucumberSeeds, 0.6, { n: 10, blooms: 0, spill: 0, layers: 0.5 });
    if (!thumb) for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      P.line(closed(oval(hx + Math.cos(a) * 4.4, hy + Math.sin(a) * 2.6, 1, 0.55, a, 8)), { weight: 0.4, alpha: 0.7, passes: 1, over: 0 });
    }
    P.line(closed(oval(hx, hy, 11.5, 7)), { weight: 0.45, alpha: 0.7, passes: 1 });
    P.line(closed(oval(hx, hy, 13, 8)), { weight: 0.9 });
    P.line(ell(hx, hy, 13, 10.5, 0, Math.PI, 16), { weight: 1.05 });
  }
  shadow(P, r, 50, 30, cut ? 85 : 80);
}
function sprig(P: Painter, r: Rng, c: string, narrow: boolean, thumb: boolean) {
  const stem: Pt[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    stem.push([44 + t * 10 + Math.sin(t * 3) * 3, 84 - t * 64]);
  }
  P.line(stem, { weight: 1.1 });
  const n = narrow ? 18 : 9;
  for (let i = 2; i < n; i++) {
    const t = i / n;
    const [x, y] = stem[Math.round(t * 20)];
    const side = i % 2 ? 1 : -1;
    const len = narrow ? 9 - t * 3 : 15 - t * 6;
    const ang = side > 0 ? -0.6 - t * 0.3 : Math.PI + 0.6 + t * 0.3;
    leafAt(P, x, y, len, narrow ? 1.2 : 5.5 - t * 1.5, ang + gauss(r) * 0.1, mixHex(c, SKETCH.pool, r() * 0.15), thumb);
  }
  leafAt(P, stem[20][0], stem[20][1], narrow ? 7 : 10, narrow ? 1.1 : 4, -Math.PI / 2 + 0.1, c, thumb);
  shadow(P, r, 48, 14);
}

function heap(P: Painter, r: Rng, c: string, grain: Grain, thumb: boolean) {
  const [cx, rim] = [50, 63];
  const body: Pt[] = [[80, rim], [76, 70], [68, 76], [32, 76], [24, 70], [20, rim]];
  P.wash([...body, ...ell(cx, rim, 30, 7, Math.PI, Math.PI * 2, 20)], DISH, 0.55, { n: 14, blooms: 0 });
  if (grain !== 'stick') {
    const mound = [...ell(cx, rim, 23, 14, Math.PI, Math.PI * 2, 20), ...ell(cx, rim, 23, 5, 0, Math.PI, 12)];
    P.wash(mound, c, grain === 'crystal' || grain === 'powder' ? 0.7 : 0.95, { n: 14 });
    P.wash(mound.filter(([x]) => x > cx), shade(c), 0.35, { layers: 0.5, spill: 0, blooms: 0, fadeTo: 0 });
  }
  const spot = (): Pt => { const a = Math.PI + r() * Math.PI; const d = Math.sqrt(r()); return [cx + Math.cos(a) * 21 * d, rim + Math.sin(a) * 12 * d + 2]; };
  if (!thumb && (grain === 'crystal' || grain === 'powder')) P.dots(Array.from({ length: grain === 'crystal' ? 40 : 60 }, () => [...spot(), grain === 'crystal' ? 0.5 + r() * 0.4 : 0.25 + r() * 0.2] as [number, number, number]), grain === 'crystal' ? SKETCH.white : shade(c), 0.6);
  const pieces = (n: number, draw: (x: number, y: number, a: number, loose: boolean) => void) => {
    for (const [x, y] of Array.from({ length: n }, () => spot()).sort((p, q) => p[1] - q[1])) draw(x, y, r() * Math.PI, false);
    for (const [x, y] of [[30, 82], [41, 84], [70, 83]] as Pt[]) draw(x + gauss(r), y, r() * Math.PI, true);
  };
  if (grain === 'bean' || grain === 'nut') {
    pieces(thumb ? 4 : grain === 'bean' ? 16 : 9, (x, y, a, loose) => {
      const p = oval(x, y, grain === 'bean' ? 3.8 : 3.8, grain === 'bean' ? 2.6 : 2.6, a, 12);
      // beans on the heap are scribbled over its wash; loose ones get their own
      if (grain === 'nut' || loose) P.wash(p, c, 1, { n: 8, blooms: 0, spill: 0, layers: 0.4 });
      P.line(closed(p), { weight: 0.6, passes: 1 });
      if (grain === 'bean') P.line([-2.8, -1.4, 0, 1.4, 2.8].map((u, i): Pt => { const v = [0, 0.5, 0, -0.5, 0][i]; return [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)]; }), { weight: 0.6, passes: 1, over: 0, wob: 1.2 });
    });
  }
  if (grain === 'leaf') pieces(thumb ? 6 : 16, (x, y, a) => P.line([[x - Math.cos(a) * 2.4, y - Math.sin(a) * 1.4], [x, y + 0.6], [x + Math.cos(a) * 2.4, y + Math.sin(a) * 1.4]], { weight: 0.9, passes: 1, over: 0, wob: 1.5 }));
  if (grain === 'stick') {
    for (const [x0, y0, x1, y1] of [[26, 66, 74, 56], [30, 72, 78, 66], [24, 60, 68, 68]]) {
      const n = Math.hypot(x1 - x0, y1 - y0);
      const [nx, ny] = [-(y1 - y0) / n * 2.6, (x1 - x0) / n * 2.6];
      const p: Pt[] = [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]];
      P.wash(p, c, 1, { n: 10, blooms: 0, spill: 0 });
      P.line(closed(p), { weight: 0.8 });
      P.line(closed(oval(x1, y1, 2.2, 2.6, 0, 10)), { weight: 0.6, passes: 1 });
    }
  }
  P.line(closed(ell(cx, rim, 30, 7, 0, Math.PI * 2, 32)), { weight: 0.9 });
  P.line([[80, rim], [76, 70], [68, 76], [32, 76], [24, 70], [20, rim]], { weight: 1.05 });
  shadow(P, r, cx, 30, 78);
}

function egg(P: Painter, r: Rng, c: string) {
  const shape = (cx: number, cy: number, rx: number, ry: number, rot: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i < 28; i++) {
      const t = (i / 28) * Math.PI * 2;
      const u = rx * Math.cos(t) * (0.84 + 0.16 * Math.sin(t));
      const v = ry * Math.sin(t);
      out.push([cx + u * Math.cos(rot) - v * Math.sin(rot), cy + u * Math.sin(rot) + v * Math.cos(rot)]);
    }
    return out;
  };
  for (const [x, y, rx, ry, rot] of [[40, 58, 15, 21, 0.05], [64, 74, 14, 19, 1.45]] as const) {
    const p = shape(x, y, rx, ry, rot);
    ball(P, p, c, x, y, ry, 0.8);
    P.line(closed(p), { weight: 1.05 });
  }
  shadow(P, r, 52, 28);
}

function flower(P: Painter, r: Rng, c: string, centre: string, thumb: boolean) {
  const [cx, cy] = [48, 42];
  const stem: Pt[] = [[cx, cy + 6], [cx + 2, cy + 22], [cx + 1, 86]];
  P.line(stem, { weight: 1 });
  leafAt(P, cx + 1.6, 68, 14, 4.2, -0.5, LEAF, thumb);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + r() * 0.2;
    const p = oval(cx + Math.cos(a) * 10, cy + Math.sin(a) * 8, 10, 5.6, a, 16);
    P.wash(p, mixHex(c, SKETCH.white, r() * 0.2), 0.9, { n: 10, blooms: 0 });
    P.line(closed(p), { weight: 0.75 });
  }
  const mid = oval(cx, cy, 4.2, 3.6, 0, 12);
  P.wash(mid, centre, 1, { n: 8, blooms: 0, spill: 0 });
  P.line(closed(mid), { weight: 0.6 });
  shadow(P, r, cx, 12);
}

function bar(P: Painter, r: Rng, c: string, thumb: boolean) {
  const t: Pt[] = [[20, 62], [62, 50], [82, 62], [40, 75]];
  const front: Pt[] = [[20, 62], [40, 75], [82, 62], [82, 66], [40, 79], [20, 66]];
  P.wash(front, shade(c), 1, { n: 12, blooms: 0, spill: 0 });
  P.wash(t, c, 1, { n: 12, blooms: 0 });
  if (!thumb) {
    for (let i = 1; i < 4; i++) { const f = i / 4; P.line([[20 + 42 * f, 62 - 12 * f], [40 + 42 * f, 75 - 13 * f]], { weight: 0.45, alpha: 0.7, passes: 1, over: 0 }); }
    P.line([[30, 68.5], [72, 56]], { weight: 0.45, alpha: 0.7, passes: 1, over: 0 });
  }
  P.line(closed(t), { weight: 1 });
  P.line([[20, 62], [20, 66], [40, 79], [82, 66], [82, 62]], { weight: 1 });
  P.line([[40, 75], [40, 79]], { weight: 0.8 });
  shadow(P, r, 52, 30, 80);
}

function mushroom(P: Painter, r: Rng, c: string, funnel: boolean, thumb: boolean) {
  const stemC = mixHex(c, SKETCH.white, 0.72);
  const gillC = mixHex(stemC, c, 0.45);
  // back to front: a small one standing behind, then the big one
  for (const [cx, rim, R, h, lean] of [[68, 68, 12, 10, 0.1], [40, 57, 21, 17, -0.05]] as const) {
    const foot = GROUND - (R < 15 ? 2 : 0);
    if (funnel) {
      // a chanterelle: a trumpet flaring from the stem into a wavy, open rim
      const wav = (t: number) => Math.sin(t * 5 + cx) * 1.4 + Math.sin(t * 9 + cx) * 0.6;
      const side = (s: number): Pt[] => Array.from({ length: 13 }, (_, i) => { const t = i / 12; const flare = R * (0.24 + 0.76 * Math.pow(1 - t, 2.6)); return [cx + lean * (foot - rim) * t + s * flare, rim + t * (foot - rim)] as Pt; });
      const front = Array.from({ length: 25 }, (_, i): Pt => { const t = (i / 24) * Math.PI; return [cx + Math.cos(t) * R, rim + Math.sin(t) * R * 0.3 + wav(t)]; });
      const back = Array.from({ length: 25 }, (_, i): Pt => { const t = Math.PI + (i / 24) * Math.PI; return [cx + Math.cos(t) * R, rim + Math.sin(t) * R * 0.3 + wav(t)]; });
      P.wash([...side(1).slice().reverse(), ...front, ...side(-1)], c, 0.95, { n: 16 });
      P.wash(side(1).slice(0, 9).concat(side(1).slice(0, 9).reverse().map(([x, y]): Pt => [x - R * 0.3, y])), shade(c), 0.35, { layers: 0.5, spill: 0, blooms: 0, fadeTo: 0 });
      P.wash([...back, ...front.slice().reverse()], mixHex(c, SKETCH.pool, 0.12), 0.95, { n: 14, blooms: 0, spill: 0, layers: 0.7 });
      // the ridges running down from the rim into the stem
      if (!thumb) for (let k = 1; k < 8; k++) {
        const t0 = (k / 8) * Math.PI;
        const pts: Pt[] = [];
        for (let i = 0; i <= 8; i++) { const t = i / 8; const flare = R * (0.24 + 0.76 * Math.pow(1 - t * 0.7, 2.6)); pts.push([cx + lean * (foot - rim) * t * 0.7 + Math.cos(t0) * flare, rim + R * 0.3 * Math.sin(t0) * (1 - t) + t * 0.7 * (foot - rim)]); }
        P.line(pts, { weight: 0.4, alpha: 0.6, passes: 1, over: 0, gaps: 0.4 });
      }
      P.line(side(1), { weight: 1 });
      P.line(side(-1), { weight: 1 });
      P.line(front, { weight: 1.05 });
      P.line(back, { weight: 0.8, alpha: 0.85 });
      continue;
    }
    const sw = R * 0.3;
    const stem: Pt[] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; stem.push([cx + lean * (foot - rim) * t + sw * (0.85 + 0.3 * t * t), rim + t * (foot - rim)]); }
    for (let i = 10; i >= 0; i--) { const t = i / 10; stem.push([cx + lean * (foot - rim) * t - sw * (0.85 + 0.3 * t * t), rim + t * (foot - rim)]); }
    P.wash(stem, stemC, 0.8, { n: 12, blooms: 0, spill: 0.4 });
    P.wash(stem.slice(0, 11).concat(stem.slice(0, 11).reverse().map(([x, y]): Pt => [x - sw * 0.6, y])), shade(stemC), 0.35, { layers: 0.5, spill: 0, blooms: 0, fadeTo: 0 });
    P.line(stem.slice(0, 11), { weight: 0.9 });
    P.line(stem.slice(11), { weight: 0.9 });
    // the gills, a dark crescent under the cap's edge
    const under = [...ell(cx, rim, R * 0.97, R * 0.1, Math.PI, 0, 16), ...ell(cx, rim, R * 0.97, R * 0.24, 0, Math.PI, 16)];
    P.wash(under, gillC, 0.85, { n: 12, blooms: 0, spill: 0 });
    if (!thumb) for (let k = 1; k < 16; k++) {
      const a = (k / 16) * Math.PI;
      P.line([[cx + Math.cos(a) * R * 0.95, rim + Math.sin(a) * R * 0.1], [cx + Math.cos(a) * sw * 1.1, rim + Math.sin(a) * R * 0.22]], { weight: 0.4, alpha: 0.6, passes: 1, over: 0, gaps: 0.3 });
    }
    P.line(ell(cx, rim, R * 0.97, R * 0.24, 0.1, Math.PI - 0.1, 16), { weight: 0.6, alpha: 0.8 });
    // the cap: a dome with its edge rolled under
    const cap: Pt[] = [];
    for (let i = 0; i <= 26; i++) {
      const t = Math.PI + (i / 26) * Math.PI;
      cap.push([cx + Math.cos(t) * R * (1 + 0.04 * Math.sin(t * 2)), rim - h * Math.abs(Math.sin(t)) ** 0.7]);
    }
    const capPts = [...cap, ...ell(cx, rim, R, R * 0.1, 0, Math.PI, 14)];
    ball(P, capPts, c, cx, rim - h * 0.45, R, 0.95);
    if (!thumb) P.dots(Array.from({ length: Math.round(R) }, () => { const a = Math.PI + r() * Math.PI; const d = Math.sqrt(r()) * 0.85; return [cx + Math.cos(a) * R * d, rim + Math.sin(a) * h * d, 0.3 + r() * 0.35] as [number, number, number]; }), shade(c), 0.35);
    P.line(cap, { weight: 1.1 });
    P.line(ell(cx, rim, R, R * 0.1, 0.05, Math.PI - 0.05, 18), { weight: 0.9 });
  }
  shadow(P, r, 52, 30);
}

/** A lumpy outline: an oval pushed in and out by a few slow bumps. */
function lump(r: Rng, cx: number, cy: number, rx: number, ry: number, rot: number, bumps: number, n = 32): Pt[] {
  const ph = Array.from({ length: 3 }, () => r() * Math.PI * 2);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const k = 1 + bumps * (0.5 * Math.sin(t * 3 + ph[0]) + 0.3 * Math.sin(t * 5 + ph[1]) + 0.2 * Math.sin(t * 2 + ph[2]));
    const u = rx * Math.cos(t) * k;
    const v = ry * Math.sin(t) * k;
    return [cx + u * Math.cos(rot) - v * Math.sin(rot), cy + u * Math.sin(rot) + v * Math.cos(rot)] as Pt;
  });
}

function root(P: Painter, r: Rng, c: string, rough: boolean, thumb: boolean) {
  if (rough) {
    // a truffle: a warty knob, and a shaved slice showing its marbling
    const knob = lump(r, 42, 62, 19, 17, 0.2, 0.07, 40);
    ball(P, knob, c, 42, 62, 18, 1.05);
    if (!thumb) P.dots(Array.from({ length: 70 }, () => { const a = r() * Math.PI * 2; const d = Math.sqrt(r()) * 16; return [42 + Math.cos(a) * d, 62 + Math.sin(a) * d * 0.9, 0.35 + r() * 0.35] as [number, number, number]; }), mixHex(c, SKETCH.white, 0.3), 0.45);
    P.line(closed(knob), { weight: 1.1 });
    const [sx, sy] = [68, 77];
    const slice = lump(r, sx, sy, 15, 7.5, -0.1, 0.05, 28);
    P.wash(slice, mixHex(c, SKETCH.white, 0.45), 0.9, { n: 12, blooms: 0 });
    if (!thumb) for (let k = 0; k < 6; k++) {
      const pts: Pt[] = [];
      let [x, y] = [sx - 11 + r() * 6, sy - 4 + r() * 8];
      let a = gauss(r) * 0.8;
      for (let i = 0; i < 6; i++) { pts.push([x, y]); a += gauss(r) * 0.7; x += Math.cos(a) * 2.6; y += Math.sin(a) * 1.3; }
      P.line(pts.filter(([px, py]) => ((px - sx) / 13.5) ** 2 + ((py - sy) / 6.6) ** 2 < 1), { weight: 0.5, alpha: 0.7, passes: 1, over: 0, wob: 1.4 });
    }
    P.line(closed(slice), { weight: 0.9 });
    P.line(lump(r, sx, sy + 1.2, 15, 7.5, -0.1, 0.05, 28).slice(1, 14), { weight: 0.6, alpha: 0.7, passes: 1 });
    shadow(P, r, 52, 30);
    return;
  }
  // tubers: a big one lying across and a smaller one in front, with eyes and a root tail
  for (const [cx, cy, rx, ry, rot] of [[44, 63, 25, 13, -0.22], [68, 75, 14, 9, 0.35]] as const) {
    const t = lump(r, cx, cy, rx, ry, rot, 0.06);
    ball(P, t, mixHex(c, SKETCH.pool, r() * 0.12), cx, cy, ry * 1.4, 1);
    if (!thumb) for (let k = 0; k < Math.round(rx / 5); k++) {
      const a = r() * Math.PI * 2;
      const d = 0.4 + r() * 0.45;
      const [x, y] = [cx + Math.cos(a) * rx * d * Math.cos(rot) - Math.sin(a) * ry * d * Math.sin(rot), cy + Math.cos(a) * rx * d * Math.sin(rot) + Math.sin(a) * ry * d * Math.cos(rot)];
      P.line(ell(x, y, 1.6, 0.7, 0.3, Math.PI - 0.3, 5, a), { weight: 0.5, passes: 1, over: 0 });
    }
    P.line(closed(t), { weight: 1.05 });
    const tip: Pt = [cx + Math.cos(rot) * rx * 1.02, cy + Math.sin(rot) * rx * 1.02];
    P.line([tip, [tip[0] + 4, tip[1] - 1 + gauss(r)], [tip[0] + 7, tip[1] + 1]], { weight: 0.5, passes: 1, wob: 1.2 });
  }
  shadow(P, r, 52, 32);
}

function scallions(P: Painter, r: Rng, c: string, thumb: boolean) {
  // three lying across: white bulbs and roots at the left, green leaves splaying right
  for (const [y0, tilt] of [[66, -0.16], [74, -0.1], [81, -0.04]] as const) {
    const at = (t: number, dy = 0): Pt => [18 + t * 64, y0 + t * 64 * tilt + dy];
    const white: Pt[] = [...[0, 0.1, 0.2, 0.3].map((t, i) => at(t, -[3.2, 3.6, 2.8, 2.2][i])), ...[0.3, 0.2, 0.1, 0].map((t, i) => at(t, [2.2, 2.8, 3.6, 3.2][i]))];
    P.wash(white, SKETCH.white, 0.6, { n: 8, blooms: 0, spill: 0 });
    P.line(closed(white), { weight: 0.8 });
    for (let k = 0; k < (thumb ? 2 : 5); k++) { const [x, y] = at(0, gauss(r) * 1.4); P.line([[x, y], [x - 3 - r() * 2, y + gauss(r) * 1.6]], { weight: 0.4, passes: 1, over: 0, wob: 1.4 }); }
    for (const fan of [-1, 1]) {
      const leaf: Pt[] = [];
      for (let i = 0; i <= 10; i++) { const t = 0.3 + (i / 10) * 0.7; const [x, y] = at(t, fan * (t - 0.3) * 6 * (1 + r() * 0.2)); leaf.push([x, y - 1.6 * (1 - i / 10)]); }
      for (let i = 10; i >= 0; i--) { const t = 0.3 + (i / 10) * 0.7; const [x, y] = at(t, fan * (t - 0.3) * 6); leaf.push([x, y + 1.6 * (1 - i / 10)]); }
      P.wash(leaf, mixHex(c, SKETCH.pool, r() * 0.2), 0.9, { n: 10, blooms: 0 });
      P.line(leaf.slice(0, 11), { weight: 0.75 });
    }
  }
  shadow(P, r, 50, 34);
}

function bulb(P: Painter, r: Rng, c: string, style: 'onion' | 'garlic' | 'scallion', thumb: boolean) {
  if (style === 'scallion') return scallions(P, r, c, thumb);
  const garlic = style === 'garlic';
  const [cx, cy, R] = [42, 62, garlic ? 19 : 20];
  // round at the bottom, drawn up to a papery point
  const outline: Pt[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const up = Math.max(0, -Math.sin(t));
    const w = R * (1 - 0.55 * up ** 3) * (garlic ? 1 + 0.05 * Math.abs(Math.sin(t * 3)) : 1);
    outline.push([cx + Math.cos(t) * w, cy + Math.sin(t) * R * (garlic ? 0.85 : 0.95) - up ** 4 * R * 0.45]);
  }
  ball(P, outline, c, cx, cy, R, garlic ? 0.75 : 0.95);
  const top = cy - R * 1.4;
  const neck: Pt[] = [[cx - 3, top + 3], [cx - 1.5, top - 6], [cx + 0.5, top - 10], [cx + 2, top - 6], [cx + 3, top + 3]];
  P.wash(neck, mixHex(c, SKETCH.pool, 0.15), 0.8, { n: 8, blooms: 0, spill: 0 });
  P.line(neck, { weight: 0.8 });
  // lines running from the neck to the root: skins, or the cloves of a head of garlic
  for (const k of garlic ? [-0.72, -0.4, -0.12, 0.18, 0.46, 0.74] : [-0.6, -0.25, 0.1, 0.45]) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([cx + k * R * Math.sin(t * Math.PI) * (garlic ? 1.05 : 0.95) + k * 2 * (1 - t), top + 3 + t * (cy + R * 0.85 - top - 3)]); }
    if (!thumb || garlic) P.line(pts, { weight: garlic ? 0.6 : 0.45, alpha: garlic ? 0.85 : 0.6, passes: 1, gaps: 0.4 });
  }
  P.line(closed(outline), { weight: 1.1 });
  // the root whiskers
  for (let k = 0; k < (thumb ? 3 : 7); k++) { const x = cx - 4 + k * 1.3; P.line([[x, cy + R * 0.86], [x + gauss(r) * 2, cy + R * 0.86 + 2.5 + r() * 2]], { weight: 0.45, passes: 1, over: 0, wob: 1.4 }); }
  const [hx, hy] = [68, 76];
  if (garlic) {
    // a loose clove
    const clove: Pt[] = [];
    for (let i = 0; i <= 20; i++) { const t = (i / 20) * Math.PI * 2; clove.push([hx + Math.cos(t) * 9 * (1 - 0.45 * Math.max(0, Math.cos(t)) ** 2), hy + Math.sin(t) * 5.5 * (1 - 0.3 * Math.max(0, Math.cos(t)))]); }
    const rot = clove.map(([x, y]): Pt => [hx + (x - hx) * Math.cos(-0.35) - (y - hy) * Math.sin(-0.35), hy + (x - hx) * Math.sin(-0.35) + (y - hy) * Math.cos(-0.35)]);
    ball(P, rot, c, hx, hy, 7, 0.75);
    P.line(closed(rot), { weight: 0.9 });
  } else {
    // the cut half: skin round the back, rings on the face
    const face = oval(hx, hy, 15, 8.5, 0, 26);
    P.wash([...ell(hx, hy, 15, 12, 0, Math.PI, 16), ...ell(hx, hy, 15, 8.5, Math.PI, Math.PI * 2, 16)], c, 0.95, { n: 12, blooms: 0 });
    P.wash(face, mixHex(c, SKETCH.white, 0.7), 0.85, { n: 12, blooms: 0, spill: 0 });
    for (const f of thumb ? [0.55] : [0.25, 0.45, 0.65, 0.84]) P.line(closed(oval(hx, hy + (1 - f) * 0.8, 15 * f, 8.5 * f, 0, 20)), { weight: 0.45, alpha: 0.65, passes: 1, gaps: 0.3 });
    P.line(closed(face), { weight: 0.9 });
    P.line(ell(hx, hy, 15, 12, 0, Math.PI, 16), { weight: 1.05 });
  }
  shadow(P, r, 52, 30);
}

function seaweed(P: Painter, r: Rng, c: string, thumb: boolean) {
  // a dried sheet behind, and ruffled ribbons of kelp in front
  const sheet: Pt[] = [[22, 46], [64, 38], [72, 66], [28, 74]];
  P.wash(sheet, mixHex(c, SKETCH.pool, 0.45), 0.9, { n: 12, blooms: 0 });
  if (!thumb) for (let k = 1; k < 6; k++) { const f = k / 6; P.line([[22 + 6 * f, 46 + 28 * f], [64 + 8 * f, 38 + 28 * f]], { weight: 0.35, alpha: 0.45, passes: 1, gaps: 0.6 }); }
  P.line(closed(sheet), { weight: 0.9 });
  for (const [y0, y1, amp, wid] of [[72, 64, 4, 5.5], [82, 76, 3, 4.5]] as const) {
    const spine: Pt[] = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30; spine.push([14 + t * 74, y0 + t * (y1 - y0) + Math.sin(t * 7 + r() * 0.3) * amp]); }
    const top = spine.map(([x, y], i): Pt => [x, y - wid * (0.6 + 0.4 * Math.sin((i / 30) * Math.PI)) - Math.sin(i * 1.7) * 0.9]);
    const bot = spine.map(([x, y], i): Pt => [x, y + wid * (0.6 + 0.4 * Math.sin((i / 30) * Math.PI)) + Math.sin(i * 1.3) * 0.9]);
    const body = [...top, ...[...bot].reverse()];
    P.wash(body, mixHex(c, SKETCH.pool, r() * 0.15), 0.95, { n: 18 });
    P.wash(bot, shade(c), 0.4, { layers: 0.5, spill: 0, blooms: 0, fadeTo: 0 });
    if (!thumb) P.line(spine.slice(1, 29), { weight: 0.4, alpha: 0.55, passes: 1, gaps: 0.5 });
    P.line(top, { weight: 0.9, wob: 1.3 });
    P.line(bot, { weight: 0.9, wob: 1.3 });
  }
  shadow(P, r, 50, 34, 88);
}

function wedge(P: Painter, r: Rng, c: string, rind: string, thumb: boolean) {
  // lying on its side: the point to the left, the rind at the back right
  const [A, B, C] = [[16, 66], [74, 50], [80, 64]] as Pt[];
  const d = 15;
  const down = ([x, y]: Pt): Pt => [x, y + d];
  P.wash([A, C, down(C), down(A)], shade(c), 0.9, { n: 12, blooms: 0 });
  P.wash([C, B, down(B), down(C)], rind, 0.95, { n: 10, blooms: 0, spill: 0 });
  P.wash([A, B, C], c, 0.9, { n: 12 });
  if (!thumb) {
    // a few holes and crumbly marks
    for (let k = 0; k < 5; k++) {
      const [u, v] = [r(), r()];
      const [x, y] = [A[0] + (C[0] - A[0]) * (0.2 + u * 0.7), A[1] + (C[1] - A[1]) * (0.2 + u * 0.7) + 3 + v * (d - 6)];
      P.line(closed(oval(x, y, 1.6 + r(), 1.1 + r() * 0.6, 0, 8)), { weight: 0.5, passes: 1, over: 0 });
    }
    P.dots(Array.from({ length: 22 }, () => { const u = r(); const v = r() * (1 - u); return [A[0] + (B[0] - A[0]) * u + (C[0] - A[0]) * v, A[1] + (B[1] - A[1]) * u + (C[1] - A[1]) * v, 0.3 + r() * 0.3] as [number, number, number]; }), shade(c), 0.4);
  }
  P.line([A, B, C, A], { weight: 1 });
  P.line([A, down(A), down(C), down(B), B], { weight: 1 });
  P.line([C, down(C)], { weight: 0.8 });
  shadow(P, r, 50, 32, 82);
}

export function paintProduce(inputs: ProduceInputs, { seed, detail = 'full' }: { seed: string; detail?: 'full' | 'thumb' }): Scene {
  const S = handFor(detail);
  const thumb = detail === 'thumb';
  const key = `${seed}|produce`;
  const r = rng(hashString(key));
  const b = new SceneBuilder(`p${hashString(seed).toString(36)}`);
  if (inputs.oil) drawBottle(b, S, { shape: 'apothecary', liquid: { hex: PANTRY.fatWashOil, alpha: 0.75 }, cap: PANTRY.cork, label: PANTRY.kraft }, `${seed}|oil`, detail, { dx: 16, dy: -14, s: 0.62 });
  const P = makePainter(S, r, rng(hashString(`${key}|hand`)), b, GLASS_SHAPES.rocks);
  const { color: c, accent } = inputs;
  switch (inputs.kind) {
    case 'citrus': citrus(P, r, c, accent ?? mixHex(c, SKETCH.white, 0.45), thumb); break;
    case 'fruit': fruit(P, r, c, accent ?? LEAF, thumb); break;
    case 'berries': berries(P, r, c, inputs.berry ?? 'round', thumb); break;
    case 'long': long(P, r, c, !!inputs.cut, thumb); break;
    case 'sprig': sprig(P, r, c, inputs.leaf === 'narrow', thumb); break;
    case 'heap': heap(P, r, c, inputs.grain ?? 'powder', thumb); break;
    case 'egg': egg(P, r, c); break;
    case 'flower': flower(P, r, c, accent ?? PANTRY.flowerCentre, thumb); break;
    case 'bar': bar(P, r, c, thumb); break;
    case 'mushroom': mushroom(P, r, c, inputs.cap === 'funnel', thumb); break;
    case 'root': root(P, r, c, !!inputs.rough, thumb); break;
    case 'bulb': bulb(P, r, c, inputs.bulb ?? 'onion', thumb); break;
    case 'seaweed': seaweed(P, r, c, thumb); break;
    case 'wedge': wedge(P, r, c, accent ?? shade(c), thumb); break;
  }
  return b.done();
}
