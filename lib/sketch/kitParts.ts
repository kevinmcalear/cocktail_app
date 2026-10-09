// The shapes bar kit is drawn from (kit.ts), in the same hand as the produce
// still lifes (produce.ts): turned things seen a little from above (tins,
// jugs, flasks), round bars (handles, shafts, probes) and boxes (appliances).
// Glass units, 0 to 100, with the ground at 86.

import { SKETCH } from '@/constants/sketch';
import { ell, type Pt } from './geometry';
import type { Painter, WashOpts } from './painter';
import { closed, oval, shade } from './produce';
import { mixHex } from './random';
import { LIFT } from './styles';

/** How round a top looks from a little above. */
export const E = 0.26;
export const STEEL = SKETCH.steel;
export const STEEL_DARK = SKETCH.steelDark;
export const GLASS = SKETCH.glassGrey;
/** Made things have straighter edges than fruit: less wobble and spill in the wash. */
export const CRISP: WashOpts = { blooms: 0, spill: 0, v1: 0.05, v2: 0.06, misreg: 0.4 };

export const spin = (p: Pt, c: Pt, a: number): Pt => {
  const [dx, dy] = [p[0] - c[0], p[1] - c[1]];
  return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
};

// --- turned things: a profile of [y, radius] pairs, top to bottom ---

export interface Lathe {
  cx: number;
  prof: Pt[];
  /** Leans it about its middle, in radians. */
  tilt?: number;
}

export const can = (cx: number, y0: number, y1: number, r0: number, r1: number, tilt = 0): Lathe => ({ cx, prof: [[y0, r0], [y1, r1]], tilt });

export function radiusAt(L: Lathe, y: number): number {
  const p = L.prof;
  if (y <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][0]) return p[i - 1][1] + ((p[i][1] - p[i - 1][1]) * (y - p[i - 1][0])) / (p[i][0] - p[i - 1][0] || 1);
  }
  return p[p.length - 1][1];
}

const top = (L: Lathe) => L.prof[0][0];
const bottom = (L: Lathe) => L.prof[L.prof.length - 1][0];
const turn = (L: Lathe) => {
  const piv: Pt = [L.cx, (top(L) + bottom(L)) / 2];
  const a = L.tilt ?? 0;
  return (p: Pt): Pt => (a ? spin(p, piv, a) : p);
};
const ys = (y0: number, y1: number) => {
  const n = Math.max(2, Math.ceil(Math.abs(y1 - y0) / 1.5));
  return Array.from({ length: n + 1 }, (_, i) => y0 + ((y1 - y0) * i) / n);
};

/** The outline between two heights as a solid: back arc above, front arc below. */
export function latheSil(L: Lathe, y0 = top(L), y1 = bottom(L), inset = 0): Pt[] {
  const T = turn(L);
  const r = (y: number) => Math.max(0.2, radiusAt(L, y) - inset);
  const right = ys(y0, y1).map((y): Pt => [L.cx + r(y), y]);
  const left = ys(y1, y0).map((y): Pt => [L.cx - r(y), y]);
  return [...right, ...ell(L.cx, y1, r(y1), r(y1) * E, 0, Math.PI, 14), ...left, ...ell(L.cx, y0, r(y0), r(y0) * E, Math.PI, Math.PI * 2, 14)].map(T);
}

/** A band down the front, between two places across it (-1 left edge, 1 right edge). */
export function latheStripe(L: Lathe, ua: number, ub: number, y0 = top(L), y1 = bottom(L)): Pt[] {
  const T = turn(L);
  const at = (u: number) => (y: number): Pt => { const R = radiusAt(L, y); return [L.cx + u * R, y + R * E * Math.sqrt(Math.max(0, 1 - u * u))]; };
  return [...ys(y0, y1).map(at(ua)), ...ys(y1, y0).map(at(ub))].map(T);
}

/** The front half of a ring round it at a height. */
export function latheRing(L: Lathe, y: number, inset = 0): Pt[] {
  const R = radiusAt(L, y) - inset;
  return ell(L.cx, y, R, R * E, 0.05, Math.PI - 0.05, 16).map(turn(L));
}

/** The whole ellipse at a height (an open top, a lid). */
export function latheOval(L: Lathe, y: number, inset = 0): Pt[] {
  const R = radiusAt(L, y) - inset;
  return oval(L.cx, y, R, R * E).map(turn(L));
}

export interface TurnOpts {
  /** Brushed steel: a dark reflection down the middle and a bright one beside it. */
  metal?: boolean;
  /** Clear glass: a thin wash, no shaded side. */
  glass?: boolean;
  /** An open top shows its dark inside, or this colour (water, a drink). */
  open?: boolean | string;
  /** The top's colour when closed. */
  lid?: string;
  strength?: number;
  weight?: number;
}

export function turned(P: Painter, L: Lathe, color: string, o: TurnOpts = {}) {
  const T = turn(L);
  const [y0, y1] = [top(L), bottom(L)];
  P.wash(latheSil(L), color, o.strength ?? (o.glass ? 0.32 : 0.9), { n: 24, v1: 0.08, misreg: 0.6, blooms: o.glass ? 0 : 0.6 });
  if (o.metal) {
    P.wash(latheStripe(L, 0.1, 0.55), mixHex(color, STEEL_DARK, 0.6), 0.75, { ...CRISP, layers: 0.6, n: 16 });
    P.wash(latheStripe(L, 0.78, 0.98), mixHex(color, STEEL_DARK, 0.4), 0.45, { ...CRISP, layers: 0.5, n: 12 });
  } else if (!o.glass) {
    P.wash(latheStripe(L, 0.3, 1), shade(color), 0.4, { ...CRISP, layers: 0.5, fadeTo: 0, n: 14 });
  }
  const R = radiusAt(L, (y0 + y1) / 2);
  const [hx, hy] = T([L.cx - R * 0.5, (y0 + y1) / 2 + R * E * 0.8]);
  P.soft(hx, hy, Math.max(0.8, R * 0.12), (y1 - y0) * 0.36, L.tilt ?? 0, LIFT, o.glass ? 0.55 : 0.75);
  if (o.open) P.wash(latheOval(L, y0 + radiusAt(L, y0) * E * 0.12, radiusAt(L, y0) * 0.07), typeof o.open === 'string' ? o.open : mixHex(color, SKETCH.pool, 0.5), 0.95, { n: 12, blooms: 0, spill: 0 });
  else P.wash(latheOval(L, y0), o.lid ?? mixHex(color, SKETCH.white, 0.35), 0.85, { n: 12, blooms: 0, spill: 0 });
  turnedLines(P, L, o.weight ?? 1);
}

export function turnedLines(P: Painter, L: Lathe, w = 1, ends = true) {
  const T = turn(L);
  const [y0, y1] = [top(L), bottom(L)];
  P.line(ys(y0, y1).map((y): Pt => [L.cx + radiusAt(L, y), y]).map(T), { weight: 1.05 * w });
  P.line(ys(y0, y1).map((y): Pt => [L.cx - radiusAt(L, y), y]).map(T), { weight: 1.05 * w });
  const rb = radiusAt(L, y1);
  P.line(ell(L.cx, y1, rb, rb * E, 0, Math.PI, 18).map(T), { weight: 1.1 * w });
  if (ends) P.line(closed(latheOval(L, y0)), { weight: 0.95 * w });
}

/** What's inside clear glass, from a height down. */
export function contents(P: Painter, L: Lathe, y: number, color: string, strength = 0.8) {
  P.wash(latheSil(L, y, bottom(L) - 0.6, 1), color, strength, { n: 16, blooms: 0.5, spill: 0 });
  P.wash(latheOval(L, y, 1), mixHex(color, SKETCH.white, 0.3), strength * 0.6, { n: 10, blooms: 0, spill: 0, layers: 0.5 });
  P.line(closed(latheOval(L, y, 1)), { weight: 0.5, alpha: 0.7, passes: 1, gaps: 0.5 });
}

// --- round bars ---

export interface RodOpts {
  /** Show the far end's face. */
  cap?: boolean;
  strength?: number;
  metal?: boolean;
  weight?: number;
}

/** A round bar from a to b: a handle, a shaft, a probe. */
export function rod(P: Painter, a: Pt, b: Pt, rad: number, color: string, o: RodOpts = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const d: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const n: Pt = [-d[1], d[0]];
  const at = (p: Pt, k: number, m = 0): Pt => [p[0] + n[0] * k + d[0] * m, p[1] + n[1] * k + d[1] * m];
  const end = (p: Pt, t0: number, t1: number) => Array.from({ length: 9 }, (_, i) => { const t = t0 + ((t1 - t0) * i) / 8; return at(p, Math.sin(t) * rad, Math.cos(t) * rad * 0.35); });
  const poly = [at(a, -rad), ...end(b, -Math.PI / 2, Math.PI / 2), ...end(a, Math.PI / 2, Math.PI * 1.5)];
  P.wash(poly, color, o.strength ?? 0.9, { ...CRISP, n: 16 });
  // the side facing down is in shadow
  const s = n[1] >= 0 ? 1 : -1;
  P.wash([at(a, s * rad * 0.25), at(b, s * rad * 0.25), at(b, s * rad), at(a, s * rad)], o.metal ? mixHex(color, STEEL_DARK, 0.6) : shade(color), o.metal ? 0.6 : 0.4, { n: 8, blooms: 0, spill: 0, layers: 0.5 });
  if (len > rad * 3) P.soft((a[0] + b[0]) / 2 - n[0] * s * rad * 0.45, (a[1] + b[1]) / 2 - n[1] * s * rad * 0.45, len * 0.36, Math.max(0.5, rad * 0.18), Math.atan2(d[1], d[0]), LIFT, 0.7);
  const w = o.weight ?? 1;
  P.line([at(a, rad), at(b, rad)], { weight: w });
  P.line([at(a, -rad), at(b, -rad)], { weight: w });
  if (o.cap) {
    const face = end(b, -Math.PI / 2, Math.PI * 1.5);
    P.wash(face, mixHex(color, SKETCH.white, 0.3), 0.7, { n: 8, blooms: 0, spill: 0 });
    P.line(face, { weight: 0.8 * w, passes: 1 });
  } else P.line(end(b, -Math.PI / 2, Math.PI / 2), { weight: 0.9 * w });
  P.line(end(a, Math.PI / 2, Math.PI * 1.5), { weight: 0.9 * w });
}

// --- boxes: a front face, depth running back up to the right ---

export const DEPTH: Pt = [0.55, -0.36];

export interface Box {
  x0: number;
  /** The front face's top. */
  y0: number;
  x1: number;
  /** The front face's bottom, on the ground. */
  y1: number;
  d: number;
}

export function boxFaces({ x0, y0, x1, y1, d }: Box) {
  const [dx, dy] = [DEPTH[0] * d, DEPTH[1] * d];
  return {
    front: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Pt[],
    top: [[x0, y0], [x0 + dx, y0 + dy], [x1 + dx, y0 + dy], [x1, y0]] as Pt[],
    side: [[x1, y0], [x1 + dx, y0 + dy], [x1 + dx, y1 + dy], [x1, y1]] as Pt[],
  };
}

/** A point on the top face: u across (0 left, 1 right), v back (0 front, 1 back). */
export const onTop = (B: Box, u: number, v: number): Pt => [B.x0 + (B.x1 - B.x0) * u + DEPTH[0] * B.d * v, B.y0 + DEPTH[1] * B.d * v];

export function box(P: Painter, B: Box, color: string, o: { top?: string; strength?: number } = {}) {
  const f = boxFaces(B);
  const s = o.strength ?? 0.9;
  P.wash(f.side, shade(color), s, { ...CRISP, n: 20 });
  P.wash(f.front, color, s, { ...CRISP, n: 28 });
  P.wash(f.top, o.top ?? mixHex(color, SKETCH.white, 0.4), s * 0.85, { ...CRISP, n: 24 });
  P.soft(B.x0 + (B.x1 - B.x0) * 0.3, B.y0 + (B.y1 - B.y0) * 0.35, (B.x1 - B.x0) * 0.22, (B.y1 - B.y0) * 0.28, 0, LIFT, 0.35);
  boxLines(P, B);
}

export function boxLines(P: Painter, B: Box) {
  const f = boxFaces(B);
  P.line(closed(f.front), { weight: 1.05 });
  P.line([f.top[0], f.top[1], f.top[2], f.top[3]], { weight: 0.95 });
  P.line([f.side[1], f.side[2], f.side[3]], { weight: 1 });
}

/** A rounded rectangle, for screens, doors and panels. */
export function roundRect(x0: number, y0: number, x1: number, y1: number, rad: number): Pt[] {
  const c: [number, number, number][] = [[x1 - rad, y0 + rad, -Math.PI / 2], [x1 - rad, y1 - rad, 0], [x0 + rad, y1 - rad, Math.PI / 2], [x0 + rad, y0 + rad, Math.PI]];
  return c.flatMap(([x, y, a]) => ell(x, y, rad, rad, a, a + Math.PI / 2, 4));
}

/** Clips what follows to above a curve (behind the front of something). Returns how many clips to end. */
export function clipAboveCurve(P: Painter, curve: Pt[]): number {
  const sorted = [...curve].sort((p, q) => p[0] - q[0]);
  const clip: Pt[] = [[-20, -20], [120, -20], [120, sorted[sorted.length - 1][1]], ...[...sorted].reverse(), [-20, sorted[0][1]]];
  P.b.begin(clip.map(P.U));
  return 1;
}
