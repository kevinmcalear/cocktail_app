// Glass shapes and the small geometry the sketch painter draws with. Units: a
// 100 by 100 drawing, glass centred on x = 50.

import { SKETCH } from '@/constants/sketch';
import type { SketchGlass } from './types';

export type Pt = [number, number];
export type PtV = [number, number, number];

export interface GlassShape {
  rim: number;
  /** Half-width down the bowl or body: [y, half-width] pairs, top to bottom. */
  prof: Pt[];
  /** Where the drink's surface sits. */
  top: number;
  /** Inside floor of a tumbler (stemmed glasses end at the bowl). */
  base?: number;
  stem?: Pt;
  foot?: Pt;
  stemmed: boolean;
  stemW?: number;
  flare?: number;
  /** A vessel you can't see through, painted in this colour. */
  opaque?: string;
  frost?: boolean;
  face?: boolean;
  handle?: boolean;
}

// Modern bar glassware: the coupe after Nude's Savage coupe (Rémy Savage).
export const GLASS_SHAPES: Record<SketchGlass, GlassShape> = {
  coupe: { rim: 31, prof: [[31, 26.5], [34, 26.2], [38, 25.2], [42, 23.4], [45, 21], [47.5, 17.5], [49.5, 12], [50.8, 6], [51.3, 0]], top: 34.5, stem: [51.3, 86], foot: [87, 13.5], stemmed: true, stemW: 0.75, flare: 2.6 },
  nick: { rim: 28, prof: [[28, 20], [33, 19.8], [38, 18.9], [43, 16.8], [48, 13], [52, 8.5], [55, 4], [57, 0]], top: 32, stem: [57, 85], foot: [86, 12], stemmed: true, stemW: 0.8, flare: 2.6 },
  // A classic V: a touch of flare at the lip, a softened point, a long fine stem.
  martini: { rim: 22, prof: [[22, 27], [25, 24.4], [30, 20.8], [36, 16.9], [42, 13.1], [48, 9.2], [53, 5.8], [56.5, 3], [58.5, 0.8], [59, 0]], top: 26, stem: [59, 86], foot: [87, 13.5], stemmed: true, stemW: 0.7, flare: 2.4 },
  rocks: { rim: 40, prof: [[40, 25], [86, 22.5]], top: 52, base: 79, stemmed: false },
  highball: { rim: 13, prof: [[13, 18], [88, 16.5]], top: 23, base: 82, stemmed: false },
  collins: { rim: 9, prof: [[9, 14.5], [90, 13.8]], top: 16, base: 84, stemmed: false },
  fizz: { rim: 28, prof: [[28, 16.5], [86, 15.5]], top: 35, base: 80, stemmed: false },
  flute: { rim: 12, prof: [[12, 9], [20, 9.6], [34, 9.9], [46, 8.9], [54, 6.4], [59, 3.2], [61, 0]], top: 19, stem: [61, 86], foot: [87, 10], stemmed: true, stemW: 0.7, flare: 2.2 },
  wine: { rim: 20, prof: [[20, 15.5], [27, 18], [35, 19.4], [43, 18.8], [50, 15.5], [56, 10], [59.5, 4], [60.5, 0]], top: 39, stem: [60.5, 86], foot: [87, 13], stemmed: true, stemW: 0.8, flare: 2.6 },
  spritz: { rim: 20, prof: [[20, 17.5], [27, 21.5], [35, 23.5], [43, 22.5], [50, 18.5], [55.5, 11], [58, 4], [58.8, 0]], top: 31, stem: [58.8, 86], foot: [87, 14], stemmed: true, stemW: 0.95, flare: 2.8 },
  snifter: { rim: 32, prof: [[32, 12], [37, 16.5], [44, 20], [51, 20.5], [57, 17.5], [62, 11], [64.5, 4], [65, 0]], top: 51, stem: [65, 79], foot: [80, 13], stemmed: true, stemW: 1.2, flare: 3 },
  beer: { rim: 12, prof: [[12, 18], [22, 18.6], [86, 14]], top: 20, base: 83, stemmed: false },
  julep: { rim: 32, prof: [[32, 18.5], [84, 15.5]], top: 35, base: 82, stemmed: false, opaque: SKETCH.julepMetal, frost: true },
  tiki: { rim: 20, prof: [[20, 15], [32, 17.5], [50, 17.8], [70, 16.5], [85, 15]], top: 23, base: 82, stemmed: false, opaque: SKETCH.tikiClay, face: true },
  mug: { rim: 34, prof: [[34, 18.5], [84, 18]], top: 38, base: 81, stemmed: false, opaque: SKETCH.copper, handle: true },
  ceramic: { rim: 38, prof: [[38, 20], [60, 21], [84, 17]], top: 41, base: 82, stemmed: false, opaque: SKETCH.ceramicGlaze },
};

export interface GlassVariant {
  /** Stored in drawing inputs and bar glassware: '<glass>_<name>'. */
  key: string;
  label: string;
  shape: GlassShape;
}

const v = (glass: SketchGlass, name: string, label: string, shape: GlassShape = GLASS_SHAPES[glass]): GlassVariant => ({ key: `${glass}_${name}`, label, shape });

/**
 * Other shapes for the glasses bars choose most carefully, so a drink can be
 * drawn in its own bar's glass. The first is the default (GLASS_SHAPES).
 * ponytail: generic families, not real makers' glasses; a bar's own maker and
 * series live in bar_glassware and map onto one of these.
 */
export const GLASS_VARIANTS: Partial<Record<SketchGlass, GlassVariant[]>> = {
  martini: [
    v('martini', 'classic', 'Classic V'),
    v('martini', 'soft', 'Soft bowl', { rim: 24, prof: [[24, 25], [30, 24.6], [36, 23.2], [42, 20.6], [47, 17], [51, 12.4], [54, 7], [55.5, 2.5], [56, 0]], top: 28, stem: [56, 85], foot: [86, 13], stemmed: true, stemW: 0.75, flare: 2.5 }),
    // Small and low: a short stem, so it sits lower than the others.
    v('martini', 'pony', 'Little pony', { rim: 42, prof: [[42, 20], [47, 16.6], [52, 12.8], [57, 8.8], [61, 5.2], [64, 2], [65.4, 0]], top: 45.5, stem: [65.4, 85], foot: [86, 11], stemmed: true, stemW: 0.9, flare: 2.6 }),
  ],
  coupe: [
    v('coupe', 'wide', 'Wide'),
    v('coupe', 'deep', 'Deep', { rim: 27, prof: [[27, 22], [31, 21.8], [36, 20.8], [41, 18.8], [45, 16], [48.5, 12], [51, 7.5], [52.6, 3], [53, 0]], top: 31, stem: [53, 86], foot: [87, 12.5], stemmed: true, stemW: 0.8, flare: 2.6 }),
    v('coupe', 'saucer', 'Saucer', { rim: 36, prof: [[36, 30], [38, 29.4], [40.5, 27.5], [43, 24], [45, 19.5], [46.6, 13], [47.6, 6], [48, 0]], top: 38.5, stem: [48, 86], foot: [87, 14], stemmed: true, stemW: 0.7, flare: 2.4 }),
  ],
  nick: [
    v('nick', 'bell', 'Bell'),
    v('nick', 'tulip', 'Tulip', { rim: 24, prof: [[24, 16.5], [28, 17.6], [33, 18], [38, 17.4], [43, 15.6], [48, 12.4], [52, 8.4], [55, 4], [56.6, 0]], top: 30, stem: [56.6, 85], foot: [86, 11.5], stemmed: true, stemW: 0.75, flare: 2.4 }),
    v('nick', 'little', 'Little', { rim: 33, prof: [[33, 18], [37, 17.8], [41, 16.8], [45, 14.6], [48.5, 11.4], [51.5, 7.5], [53.6, 3.5], [54.6, 0]], top: 36.5, stem: [54.6, 85], foot: [86, 11], stemmed: true, stemW: 0.85, flare: 2.6 }),
  ],
  rocks: [
    v('rocks', 'straight', 'Straight'),
    v('rocks', 'heavy', 'Heavy base', { rim: 42, prof: [[42, 27], [86, 26]], top: 54, base: 74, stemmed: false }),
    v('rocks', 'tapered', 'Tapered', { rim: 44, prof: [[44, 27.5], [86, 19]], top: 56, base: 80, stemmed: false }),
  ],
  highball: [
    v('highball', 'straight', 'Straight'),
    v('highball', 'tapered', 'Tapered', { rim: 12, prof: [[12, 19.5], [88, 14]], top: 22, base: 83, stemmed: false }),
    v('highball', 'heavy', 'Heavy base', { rim: 14, prof: [[14, 18.5], [88, 18]], top: 24, base: 76, stemmed: false }),
  ],
};

/** The variants a glass can be drawn as: just its one shape when it has none. */
export const variantsOf = (glass: SketchGlass): GlassVariant[] => GLASS_VARIANTS[glass] ?? [v(glass, 'standard', 'Standard')];

/** A glass's shape in a variant; an unknown or other glass's variant draws the default. */
export function glassShape(glass: SketchGlass, variant?: string | null): GlassShape {
  return GLASS_VARIANTS[glass]?.find((x) => x.key === variant)?.shape ?? GLASS_SHAPES[glass];
}

export function hw(g: GlassShape, y: number): number {
  const p = g.prof;
  if (y <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][0]) {
      const [y0, w0] = p[i - 1];
      const [y1, w1] = p[i];
      return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
    }
  }
  return p[p.length - 1][1];
}
export const bottomOf = (g: GlassShape) => g.prof[g.prof.length - 1][0];
export const ecc = (g: GlassShape) => (g.stemmed ? 0.11 : 0.14);

export function ell(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number, rot = 0): Pt[] {
  const o: Pt[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    o.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return o;
}

/** The outline of the glass between two heights, drawn as a solid: front arc below, back arc above. */
export function band(g: GlassShape, y0: number, y1: number, inset = 0): Pt[] {
  const e = ecc(g);
  const R: Pt[] = [];
  const L: Pt[] = [];
  for (let y = y0; y <= y1; y += 1.5) {
    R.push([50 + hw(g, y) - inset, y]);
    L.push([50 - hw(g, y) + inset, y]);
  }
  const out: Pt[] = [...R];
  const hb = hw(g, y1) - inset;
  if (hb > 1) out.push(...ell(50, y1, hb, hb * e, 0, Math.PI, 14));
  else out.push([50, y1]);
  out.push(...L.reverse());
  const ht = hw(g, y0) - inset;
  out.push(...ell(50, y0, ht, ht * e, Math.PI, Math.PI * 2, 14));
  return out;
}

export function resample(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const d = Math.hypot(bx - ax, by - ay);
    if (!d) continue;
    let t = (step - carry) / d;
    while (t <= 1) {
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      t += step / d;
    }
    carry = (carry + d) % step;
  }
  return out;
}

export function resampleN(poly: Pt[], n: number): Pt[] {
  const P = [...poly, poly[0]];
  const seg: number[] = [];
  let L = 0;
  for (let i = 1; i < P.length; i++) {
    const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    seg.push(d);
    L += d;
  }
  const out: Pt[] = [];
  let i = 0;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const t = (L * k) / n;
    while (acc + seg[i] < t && i < seg.length - 1) {
      acc += seg[i];
      i++;
    }
    const f = seg[i] ? (t - acc) / seg[i] : 0;
    out.push([P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f]);
  }
  return out;
}

export function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [];
  const up: Pt[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (const q of p.reverse()) {
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  up.pop();
  lo.pop();
  return lo.concat(up);
}

export interface IceBox {
  V: Pt[];
  faces: { q: number[]; n: [number, number, number]; vis: boolean; top: boolean }[];
}

/** A block of ice: an oriented box seen from slightly above. */
export function box(cx: number, cy: number, sx: number, sy: number, sz: number, yaw: number, roll: number, pitch: number): IceBox {
  const rot = (x: number, y: number, z: number): [number, number, number] => {
    const x1 = x * Math.cos(yaw) - z * Math.sin(yaw);
    const z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
    const x2 = x1 * Math.cos(roll) - y * Math.sin(roll);
    const y2 = x1 * Math.sin(roll) + y * Math.cos(roll);
    return [x2, y2 * Math.cos(pitch) + z1 * Math.sin(pitch), -y2 * Math.sin(pitch) + z1 * Math.cos(pitch)];
  };
  const V: Pt[] = [];
  for (const X of [-1, 1]) for (const Y of [-1, 1]) for (const Z of [-1, 1]) {
    const [x, y] = rot((X * sx) / 2, (Y * sy) / 2, (Z * sz) / 2);
    V.push([cx + x, cy + y]);
  }
  const id = (X: number, Y: number, Z: number) => ((X + 1) / 2) * 4 + ((Y + 1) / 2) * 2 + (Z + 1) / 2;
  const faces: IceBox['faces'] = [];
  for (const ax of [0, 1, 2]) for (const sg of [-1, 1]) {
    const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, w]) => {
      const c = [0, 0, 0];
      c[ax] = sg;
      c[(ax + 1) % 3] = u;
      c[(ax + 2) % 3] = w;
      return id(c[0], c[1], c[2]);
    });
    const n = [0, 0, 0];
    n[ax] = sg;
    const tn = rot(n[0], n[1], n[2]);
    faces.push({ q, n: tn, vis: tn[2] > 0.02, top: ax === 1 && sg === -1 });
  }
  return { V, faces };
}

export function restOn(b: IceBox, y: number): IceBox {
  const dy = y - Math.max(...b.V.map((v) => v[1]));
  return { ...b, V: b.V.map(([x, yy]) => [x, yy + dy] as Pt) };
}
