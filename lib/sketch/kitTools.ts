// Bar kit you hold (kit.ts): shaker tins, a jigger, a mixing glass and spoon,
// a strainer, a citrus press, a peeler, a mallet and Lewis bag, an atomizer,
// scales, probes, and small bottles. Glass units, ground at 86.

import { PANTRY } from '@/constants/pantry';
import { SKETCH } from '@/constants/sketch';
import type { BottleInputs } from './bottle';
import { ell, type Pt } from './geometry';
import { box, can, clipAboveCurve, CRISP, contents, E, GLASS, latheRing, latheSil, onTop, rod, roundRect, spin, STEEL, STEEL_DARK, turned, turnedLines, type Box, type Lathe } from './kitParts';
import type { Painter, Place } from './painter';
import { closed, oval, shade, shadow } from './produce';
import { gauss, mixHex, type Rng } from './random';
import { LIFT } from './styles';

export interface KitCtx {
  P: Painter;
  r: Rng;
  thumb: boolean;
  /** Which of a kind's drawings (kit.ts KIT_VARIANTS). */
  v: string;
  /** A painter that draws moved and scaled. */
  placed: (pl: Place) => Painter;
  bottle: (inputs: BottleInputs, pl: Place, salt: string) => void;
}

const WOOD = PANTRY.wood;
const CANVAS = mixHex(PANTRY.kraft, SKETCH.white, 0.35);
const DRINK = mixHex(PANTRY.amber, SKETCH.white, 0.15);

/** Glass that shows what's behind it: wash it, draw what's inside, then call `done` for the lines. */
function glassOver(P: Painter, L: Lathe, behind: () => void, fill?: { y: number; color: string; strength?: number }) {
  P.wash(latheSil(L), GLASS, 0.3, { n: 18, blooms: 0 });
  behind();
  if (fill) contents(P, L, fill.y, fill.color, fill.strength);
  const [y0, y1] = [L.prof[0][0], L.prof[L.prof.length - 1][0]];
  const R = L.prof[0][1];
  P.soft(L.cx - R * 0.55, (y0 + y1) / 2, Math.max(0.8, R * 0.1), (y1 - y0) * 0.35, 0, LIFT, 0.6);
  turnedLines(P, L);
}

/** A seven-segment number on a little screen, from its left edge. */
function digits(P: Painter, x: number, y: number, h: number, text: string) {
  const w = h * 0.5;
  const seg: Record<string, string> = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '7': 'abc', '8': 'abcdefg' };
  let cx = x;
  for (const ch of text) {
    if (ch === '.') { P.dots([[cx - w * 0.15, y + h, 0.35]], SKETCH.charcoal, 0.8); cx += w * 0.4; continue; }
    const pts: Record<string, Pt[]> = {
      a: [[cx, y], [cx + w, y]], b: [[cx + w, y], [cx + w, y + h / 2]], c: [[cx + w, y + h / 2], [cx + w, y + h]], d: [[cx, y + h], [cx + w, y + h]],
      e: [[cx, y + h / 2], [cx, y + h]], f: [[cx, y], [cx, y + h / 2]], g: [[cx, y + h / 2], [cx + w, y + h / 2]],
    };
    for (const s of seg[ch] ?? '') P.line(pts[s], { weight: 0.45, passes: 1, over: 0, wob: 0.2 });
    cx += w * 1.6;
  }
}

/** A little screen: dark frame, pale display, and a reading at full detail. */
function screen(P: Painter, x0: number, y0: number, x1: number, y1: number, text: string, thumb: boolean) {
  const frame = roundRect(x0, y0, x1, y1, 1.2);
  P.glaze(frame, SKETCH.rubber, 0.85);
  P.glaze(roundRect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, 0.6), SKETCH.lcd, 0.95);
  if (!thumb) digits(P, x0 + 2, y0 + 2, y1 - y0 - 4, text);
  P.line(closed(frame), { weight: 0.7, passes: 1 });
}

export function tins({ P, r, thumb }: KitCtx) {
  const big = can(44, 44, 82.5, 17.5, 13.5);
  turned(P, big, STEEL, { metal: true, open: true });
  if (!thumb) P.line(latheRing(big, 76), { weight: 0.5, alpha: 0.6, passes: 1 });
  // the small tin upside down, leaning in the big one's mouth
  const front = ell(44, 44, 17.5, 17.5 * E, 0, Math.PI, 18);
  const n = clipAboveCurve(P, front);
  turned(P, can(47, 10, 54, 11.8, 14.6, -0.12), mixHex(STEEL, SKETCH.white, 0.12), { metal: true, lid: mixHex(STEEL, SKETCH.white, 0.5) });
  P.end(n);
  P.line(front, { weight: 1.15 });
  shadow(P, r, 44, 18);
}

export function jigger({ P, r, thumb }: KitCtx) {
  const low = can(50, 52, 86 - 13 * E, 4.8, 13);
  const high = can(50, 16, 51, 15.5, 4.8);
  turned(P, low, STEEL, { metal: true, lid: STEEL });
  turned(P, high, STEEL, { metal: true, open: true });
  // the line inside the cup for the smaller pour
  if (!thumb) P.line(ell(50, 25, 11.8, 11.8 * E, Math.PI + 0.3, Math.PI * 2 - 0.3, 14), { weight: 0.45, alpha: 0.7, passes: 1, over: 0 });
  const waist = can(50, 49.5, 53.5, 5.6, 5.6);
  turned(P, waist, mixHex(STEEL, STEEL_DARK, 0.2), { metal: true });
  shadow(P, r, 50, 14);
}

export function mixingGlass({ P, r, thumb }: KitCtx) {
  const g = can(42, 32, 86 - 17.5 * E, 18, 17.5);
  glassOver(P, g, () => {
    // the bar spoon leaning in: twisted shaft, bowl down in the drink, teardrop on top
    rod(P, [47, 76], [69, 8], 0.9, STEEL, { metal: true, weight: 0.8 });
    if (!thumb) for (let t = 0.42; t < 0.9; t += 0.035) { const [x, y] = [47 + 22 * t, 76 - 68 * t]; P.line([[x - 1, y + 0.3], [x + 1, y - 0.4]], { weight: 0.4, passes: 1, over: 0, wob: 0.2 }); }
    P.glaze(oval(68.8, 6.5, 2.2, 3.2), STEEL, 0.9);
    P.line(closed(oval(68.8, 6.5, 2.2, 3.2)), { weight: 0.8, passes: 1 });
  }, { y: 52, color: DRINK, strength: 0.7 });
  // ice under the surface, and the cut diamonds round the base
  for (const [x, y, s, a] of [[33, 60, 6, 0.3], [46, 63, 5.5, -0.4], [38, 70, 5, 0.9]] as const) {
    const q = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([u, v]): Pt => spin([x + u / 2, y + v / 2], [x, y], a));
    P.wash(q, SKETCH.white, 0.45, { ...CRISP, n: 6 });
    P.line(closed(q), { weight: 0.5, alpha: 0.7, passes: 1 });
  }
  if (!thumb) {
    P.b.begin(latheSil(g, 62, 86 - 17.5 * E).map(P.U));
    for (let k = -7; k <= 7; k++) for (const s of [-1, 1]) P.line([[42 + k * 5, 58], [42 + k * 5 + s * 24, 90]], { weight: 0.4, alpha: 0.45, passes: 1, over: 0 });
    P.b.end();
  }
  P.line(latheRing(g, 62), { weight: 0.55, alpha: 0.7, passes: 1 });
  // the spout
  P.line([[24.2, 31], [20.6, 29.6], [24.6, 34.5]], { weight: 0.9 });
  shadow(P, r, 42, 20);
}

export function strainer({ P, r, thumb }: KitCtx) {
  const [cx, cy, R, ry] = [42, 60, 22, 12];
  // the coil, peeping out under the front edge
  const coil: Pt[] = [];
  const loops = thumb ? 16 : 30;
  for (let i = 0; i <= loops * 10; i++) {
    const s = i / (loops * 10);
    const a = 0.15 + s * (Math.PI - 0.3);
    const ph = s * loops * Math.PI * 2;
    coil.push([cx + Math.cos(a) * R * 0.9 + Math.cos(ph) * 1.7, cy + 3 + Math.sin(a) * ry * 0.9 + Math.sin(ph) * 2.2 + 1.2]);
  }
  P.line(coil, { weight: 0.6, passes: 1, wob: 0.3, over: 0 });
  // the handle, and the tab at the back
  const handle: Pt[] = [[cx + R * 0.8, cy - 4.5], [84, cy - 17], ...ell(85.5, cy - 13.5, 3.2, 3.2, -Math.PI * 0.6, Math.PI * 0.4, 6), [cx + R * 0.85, cy + 3]];
  P.wash(handle, STEEL, 0.9, { ...CRISP, n: 10 });
  P.wash(handle.slice(-3), mixHex(STEEL, STEEL_DARK, 0.5), 0.5, { ...CRISP, n: 6 });
  P.line(closed(handle), { weight: 1 });
  if (!thumb) P.line(closed(oval(81, cy - 13.5, 2.6, 1.2, -0.45)), { weight: 0.5, passes: 1 });
  const tab: Pt[] = [[cx - 12, cy - ry + 1], [cx - 16, cy - ry - 5], [cx - 9, cy - ry - 7], [cx - 6, cy - ry + 0.5]];
  P.wash(tab, STEEL, 0.9, { ...CRISP, n: 6 });
  P.line(closed(tab), { weight: 0.9 });
  // the disc: a pale plate with a darker ring of holes
  const disc = oval(cx, cy, R, ry, 0, 32);
  P.wash(disc, STEEL, 0.9, { n: 16 });
  P.wash(oval(cx + 4, cy + 2, R * 0.7, ry * 0.65), mixHex(STEEL, STEEL_DARK, 0.45), 0.5, { ...CRISP, n: 10, layers: 0.6 });
  P.soft(cx - R * 0.35, cy - ry * 0.35, R * 0.3, ry * 0.2, -0.2, LIFT, 0.7);
  const holes: [number, number, number][] = [];
  for (const [f, k] of thumb ? ([[0.62, 10]] as const) : ([[0.38, 8], [0.6, 13], [0.8, 18]] as const)) {
    for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2 + f; holes.push([cx + Math.cos(a) * R * f, cy + Math.sin(a) * ry * f, thumb ? 1.3 : 0.9]); }
  }
  P.dots(holes, STEEL_DARK, 0.75);
  P.line(closed(disc), { weight: 1.1 });
  P.line(closed(oval(cx, cy, R * 0.9, ry * 0.88)), { weight: 0.5, alpha: 0.6, passes: 1, gaps: 0.4 });
  shadow(P, r, cx, 26, 80);
}

export function press({ P, r, thumb }: KitCtx) {
  const Y = SKETCH.lemonPeel;
  const H: Pt = [18, 66];
  const open = (p: Pt): Pt => spin(p, H, -0.36);
  // the bottom half: a bowl with holes and a long handle
  rod(P, [44, 72], [88, 80], 2.8, Y, { cap: true });
  const bowl = [...ell(33, 68, 13.5, 4.6, Math.PI, Math.PI * 2, 14), ...ell(33, 68, 13.5, 11, 0, Math.PI, 16)];
  P.wash(bowl, Y, 0.95, { n: 14 });
  P.wash(ell(33, 68, 13.5, 11, 0.2, Math.PI * 0.6, 10).concat([[33, 68]]), shade(Y), 0.4, { ...CRISP, n: 8, layers: 0.5 });
  P.glaze(oval(33, 68, 12, 3.8), mixHex(Y, SKETCH.pool, 0.35), 0.8);
  if (!thumb) P.dots(Array.from({ length: 9 }, (_, i) => [24 + i * 2.2, 68 + Math.sin(i) * 1.2, 0.55] as [number, number, number]), SKETCH.charcoal, 0.6);
  P.line(ell(33, 68, 13.5, 11, 0, Math.PI, 16), { weight: 1.1 });
  P.line(closed(oval(33, 68, 13.5, 4.6)), { weight: 0.9 });
  // the top half, swung open on its hinge
  rod(P, open([45, 62]), open([86, 58]), 2.8, Y, { cap: true });
  const dome = [...ell(33, 62.5, 14, 4.6, 0, Math.PI, 14), ...ell(33, 62.5, 14, 12, Math.PI, Math.PI * 2, 16)].map(open);
  P.wash(dome, Y, 0.95, { n: 14 });
  P.soft(...open([29, 56]), 4, 2.2, -0.36, LIFT, 0.7);
  P.line(closed(dome), { weight: 1.1 });
  P.glaze(oval(H[0], H[1], 3.4, 3.4), mixHex(Y, SKETCH.pool, 0.3), 0.9);
  P.line(closed(oval(H[0], H[1], 3.4, 3.4)), { weight: 0.9, passes: 1 });
  shadow(P, r, 52, 34, 84);
}

export function peeler({ P, r, thumb }: KitCtx) {
  // a twist of orange peel, pith showing where it turns
  const ribbon = (side: number) => Array.from({ length: 41 }, (_, i): Pt => {
    const t = i / 40;
    const w = 0.8 + 2.6 * Math.abs(Math.cos(t * Math.PI * 4));
    return [58 + t * 30 + side * w * 0.3, 80 - t * 22 + Math.sin(t * Math.PI * 4) * 4.5 + side * w];
  });
  const peel = [...ribbon(-1), ...ribbon(1).reverse()];
  P.wash(peel, SKETCH.orangePeel, 0.95, { n: 20 });
  for (let k = 0; k < 4; k++) {
    const seg = (side: number) => ribbon(side).slice(k * 10 + 5, k * 10 + 10);
    if (k % 2) P.wash([...seg(-1), ...seg(1).reverse()], mixHex(SKETCH.orangePeel, SKETCH.white, 0.6), 0.8, { ...CRISP, n: 8 });
  }
  P.line(ribbon(-1), { weight: 0.9 });
  P.line(ribbon(1), { weight: 0.9 });
  // the Y peeler lying across: black handle, steel fork, the blade between its tips
  rod(P, [44, 60], [16, 80], 4.2, SKETCH.rubber, { strength: 0.75, cap: true });
  rod(P, [44, 60], [49, 37], 1.3, STEEL, { metal: true });
  rod(P, [44, 60], [66, 50], 1.3, STEEL, { metal: true });
  const blade: Pt[] = [[49, 36], [66, 49], [64.5, 51.5], [47.5, 38.5]];
  P.wash(blade, mixHex(STEEL, SKETCH.white, 0.3), 0.95, { ...CRISP, n: 8 });
  P.line(closed(blade), { weight: 0.9 });
  if (!thumb) P.line([[50.5, 39.2], [62.5, 48.6]], { weight: 0.45, passes: 1, over: 0 });
  shadow(P, r, 50, 34, 84);
}

export function mallet({ P, r, thumb }: KitCtx) {
  // the canvas bag lying flat, puffed up with ice
  const corners: Pt[] = [[10, 72], [56, 58], [82, 72], [36, 87]];
  const bag: Pt[] = [];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4];
    for (let k = 0; k < 8; k++) { const t = k / 8; const bulge = Math.sin(t * Math.PI) * 2.4; const [nx, ny] = [b[1] - a[1], -(b[0] - a[0])]; const nl = Math.hypot(nx, ny); bag.push([a[0] + (b[0] - a[0]) * t - (nx / nl) * bulge, a[1] + (b[1] - a[1]) * t - (ny / nl) * bulge]); }
  });
  P.wash(bag, CANVAS, 0.9, { n: 16 });
  P.wash(bag.slice(16, 28), shade(CANVAS), 0.4, { ...CRISP, n: 8, fadeTo: 0 });
  if (!thumb) P.line(corners.map(([x, y]): Pt => [x + (46 - x) * 0.12, y + (72 - y) * 0.12]).concat([[10 + 36 * 0.12, 72]]), { weight: 0.4, alpha: 0.6, passes: 1, gaps: 0.7 });
  P.line(closed(bag), { weight: 1 });
  // crushed ice spilling out of the open end
  for (const [x, y, s] of [[84, 78, 3.2], [79, 82, 2.4], [88, 84, 2.2]] as const) {
    const q: Pt[] = [[x - s, y], [x - s * 0.2, y - s * 0.9], [x + s, y - s * 0.3], [x + s * 0.4, y + s * 0.7]];
    P.wash(q, SKETCH.water, 0.5, { ...CRISP, n: 6 });
    P.line(closed(q), { weight: 0.6, passes: 1 });
  }
  // the wooden mallet lying on it
  const Hd: Pt = [62, 40];
  const d: Pt = [-0.8, 0.6];
  const n: Pt = [0.6, 0.8];
  rod(P, [Hd[0] + d[0] * 6, Hd[1] + d[1] * 6], [Hd[0] + d[0] * 44, Hd[1] + d[1] * 44], 2.6, WOOD, { cap: true });
  rod(P, [Hd[0] - n[0] * 13, Hd[1] - n[1] * 13], [Hd[0] + n[0] * 13, Hd[1] + n[1] * 13], 8, WOOD, { cap: true });
  if (!thumb) for (const k of [-4, 0, 3.5]) P.line([[Hd[0] - n[0] * 11 + d[0] * k, Hd[1] - n[1] * 11 + d[1] * k], [Hd[0] + n[0] * 9 + d[0] * k, Hd[1] + n[1] * 9 + d[1] * k]], { weight: 0.4, alpha: 0.6, passes: 1, wob: 1.2, gaps: 0.5 });
  shadow(P, r, 48, 34, 86);
}

export function atomizer({ P, r, thumb }: KitCtx) {
  const body: Lathe = { cx: 50, prof: [[44, 5.5], [47, 5.5], [52, 12], [56, 15], [82, 15]] };
  glassOver(P, body, () => {}, { y: 58, color: mixHex(PANTRY.lime, SKETCH.white, 0.35), strength: 0.6 });
  turned(P, can(50, 37, 46, 6.4, 6.4), STEEL, { metal: true });
  turned(P, can(50, 28, 37, 5, 5), mixHex(STEEL, SKETCH.white, 0.2), { metal: true });
  rod(P, [45, 32], [41, 32], 1.1, STEEL, { cap: true });
  // the mist
  P.soft(28, 30, 13, 6, 0.1, SKETCH.water, 0.35);
  const mist: [number, number, number][] = [];
  for (let i = 0; i < (thumb ? 14 : 70); i++) { const d = 3 + r() * 26; const a = Math.PI + gauss(r) * 0.22; mist.push([40 + Math.cos(a) * d, 32 + Math.sin(a) * d, (thumb ? 0.7 : 0.35) + r() * 0.35]); }
  P.dots(mist, mixHex(SKETCH.glassGrey, SKETCH.pool, 0.3), 0.5);
  shadow(P, r, 50, 16);
}

export function scale({ P, r, thumb, v, placed }: KitCtx) {
  const fine = v === 'fine';
  const Q = fine ? placed({ dx: 0, dy: 10, s: 0.74 }) : P;
  const B: Box = { x0: 12, y0: 72, x1: 68, y1: 84, d: 44 };
  if (fine) {
    // the clear lid, hinged open at the back
    const [a, b] = [onTop(B, 0, 1), onTop(B, 1, 1)];
    const lid: Pt[] = [a, b, [b[0] + 5, b[1] - 30], [a[0] + 5, a[1] - 30]];
    Q.wash(lid, GLASS, 0.3, { n: 8, blooms: 0 });
    Q.line(closed(lid), { weight: 0.9 });
  }
  box(Q, B, fine ? mixHex(SKETCH.rubber, STEEL, 0.25) : SKETCH.enamel);
  // the steel platform, raised a little
  const plate = [onTop(B, 0.06, 0.12), onTop(B, 0.94, 0.12), onTop(B, 0.94, 0.86), onTop(B, 0.06, 0.86)];
  const lip = plate.map(([x, y]): Pt => [x, y + 1.6]);
  Q.wash([lip[0], lip[1], plate[1], plate[0]], STEEL_DARK, 0.6, { ...CRISP, n: 6 });
  Q.wash(plate, STEEL, 0.95, { n: 10, blooms: 0.5 });
  Q.soft(...onTop(B, 0.35, 0.55), 12, 3, -0.55, LIFT, 0.6);
  Q.line(closed(plate), { weight: 0.9 });
  screen(Q, 40, 74.5, 62, 81.5, fine ? '0.01' : '250', thumb);
  Q.wash(oval(22, 78, 2.6, 2), STEEL_DARK, 0.7, { ...CRISP, n: 6 });
  shadow(Q, r, 46, 34, 86);
}

/** A beaker of something on the ground, with a probe in it (drawn by `inside`, before the glass). */
function beaker(P: Painter, cx: number, R: number, y0: number, inside: () => void, liquid = SKETCH.water) {
  const L = can(cx, y0, 86 - R * E, R, R);
  glassOver(P, L, inside, { y: y0 + (86 - y0) * 0.35, color: liquid, strength: 0.55 });
  P.line([[cx - R, y0], [cx - R - 2.5, y0 - 1.6], [cx - R + 0.5, y0 + 2.5]], { weight: 0.8 });
}

function dial(P: Painter, cx: number, cy: number, R: number, thumb: boolean) {
  P.glaze(oval(cx, cy, R, R), STEEL, 0.95);
  P.glaze(oval(cx, cy, R * 0.78, R * 0.78), SKETCH.white, 0.9);
  if (!thumb) for (let k = 0; k < 12; k++) { const a = Math.PI * 0.75 + (k / 11) * Math.PI * 1.5; P.line([[cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6], [cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.72]], { weight: 0.4, passes: 1, over: 0 }); }
  P.line([[cx, cy], [cx + R * 0.45, cy - R * 0.4]], { weight: 0.7, passes: 1, over: 0 });
  P.line(closed(oval(cx, cy, R, R)), { weight: 1.05 });
  P.line(closed(oval(cx, cy, R * 0.78, R * 0.78)), { weight: 0.5, passes: 1 });
}

export function probe({ P, r, thumb, v }: KitCtx) {
  if (v === 'scope') {
    // a refractometer lying across: rubber eyepiece, steel tube, the prism and its blue flap
    rod(P, [70, 46], [28, 70], 5.4, STEEL, { metal: true });
    rod(P, [80, 40], [70, 46], 6, STEEL, { metal: true, cap: false });
    const flap: Pt[] = [[71, 39.5], [83, 32.5], [86.5, 36], [74.5, 43]];
    P.wash(flap, SKETCH.water, 0.9, { ...CRISP, n: 8 });
    P.line(closed(flap), { weight: 0.9 });
    rod(P, [30, 69], [18, 76], 6.6, SKETCH.rubber, { cap: true, strength: 0.8 });
    if (!thumb) P.line(closed(oval(17, 76.6, 1.5, 3.6, -0.5)), { weight: 0.5, passes: 1 });
    shadow(P, r, 50, 30, 84);
    return;
  }
  if (v === 'horn') {
    // an ultrasonic probe on its stand, the horn down in a beaker
    box(P, { x0: 12, y0: 80, x1: 64, y1: 85, d: 18 }, SKETCH.rubber, { strength: 0.75 });
    rod(P, [20, 80], [20, 10], 1.5, STEEL, { metal: true, cap: true });
    beaker(P, 46, 12, 50, () => turned(P, can(46, 38, 68, 3.2, 1.8), STEEL, { metal: true }));
    rod(P, [20, 20], [44, 20], 1.4, STEEL, { metal: true });
    turned(P, can(46, 12, 38, 6.5, 6.5), SKETCH.enamel, { lid: SKETCH.rubber });
    P.line(Array.from({ length: 13 }, (_, i): Pt => { const t = i / 12; return [46 * (1 - t) ** 2 + 2 * 72 * t * (1 - t) + 86 * t * t, 12 * (1 - t) ** 2 - 2 * 6 * t * (1 - t) + 40 * t * t]; }), { weight: 1.3, wob: 0.8 });
    shadow(P, r, 40, 28, 86);
    return;
  }
  if (v === 'pen') {
    // a pH pen standing in a beaker, and test strips beside it
    for (const [y, c] of [[84, SKETCH.orangePeel], [80, SKETCH.limeWheel]] as const) {
      const s: Pt[] = [[60, y], [86, y - 6], [86.5, y - 4], [60.5, y + 2]];
      P.wash(s, SKETCH.white, 0.6, { ...CRISP, n: 6 });
      P.wash([[80, y - 4.6], [86, y - 6], [86.5, y - 4], [80.5, y - 2.6]], c, 1, { ...CRISP, n: 6 });
      P.line(closed(s), { weight: 0.7, passes: 1 });
    }
    beaker(P, 36, 15, 48, () => turned(P, can(38, 52, 76, 3, 2.4), GLASS, { glass: true }));
    turned(P, can(38, 10, 52, 5.6, 5.4), SKETCH.enamel, { lid: SKETCH.rubber });
    screen(P, 34.5, 20, 41.5, 32, '7', thumb);
    shadow(P, r, 40, 22, 86);
    return;
  }
  // a dial thermometer clipped into a beaker
  beaker(P, 40, 15, 46, () => rod(P, [58.5, 26], [38, 79], 0.8, STEEL, { metal: true, weight: 0.8 }));
  dial(P, 60, 18, 9, thumb);
  shadow(P, r, 40, 20, 86);
}

export function bottles({ v, bottle, placed }: KitCtx) {
  if (v === 'swing') {
    for (const [i, pl] of ([{ dx: -14, dy: 0, s: 0.95 }, { dx: 18, dy: 7, s: 0.78 }] as Place[]).entries()) {
      bottle({ shape: 'beer', liquid: { hex: i ? PANTRY.gold : mixHex(PANTRY.amber, SKETCH.white, 0.3), alpha: 0.6 }, glass: i ? null : mixHex(PANTRY.lime, GLASS, 0.6), cap: SKETCH.white, label: PANTRY.kraft }, pl, `swing${i}`);
      const Q = placed(pl);
      // the porcelain stopper, its red seal, and the wire bail down to the neck
      Q.wash(oval(50, 9, 3.8, 2.6), SKETCH.white, 0.95, { ...CRISP, n: 8 });
      Q.line(closed(oval(50, 9, 3.8, 2.6)), { weight: 0.8, passes: 1 });
      Q.line([[45.8, 11.5], [54.2, 11.5]], { weight: 1.2, passes: 1, over: 0 });
      for (const s of [-1, 1]) Q.line([[50 + s * 3.6, 8.5], [50 + s * 4.6, 16], [50 + s * 3.6, 23]], { weight: 0.6, passes: 1, over: 0 });
      Q.line([[45.6, 23], [42, 26], [46, 28.5]], { weight: 0.6, passes: 1, over: 0 });
    }
    return;
  }
  if (v === 'ferment') {
    const pl = { dx: 0, dy: -2, s: 1.05 };
    bottle({ shape: 'jar', liquid: { hex: mixHex(PANTRY.olive, PANTRY.gold, 0.5), alpha: 0.6 }, cap: STEEL, label: null }, pl, 'ferment');
    const Q = placed(pl);
    // a glass weight holding things under, and the airlock on the lid
    for (const [x, y] of [[40, 66], [56, 72], [46, 78], [60, 62], [38, 76]] as const) {
      Q.wash(oval(x, y, 4, 2.4, x), PANTRY.lime, 0.6, { ...CRISP, n: 8 });
      Q.line(closed(oval(x, y, 4, 2.4, x)), { weight: 0.45, passes: 1, alpha: 0.7 });
    }
    Q.line(ell(50, 52, 14, 3, 0, Math.PI, 14), { weight: 0.7, passes: 1 });
    Q.line(ell(50, 55, 14, 3, 0, Math.PI, 14), { weight: 0.5, passes: 1, alpha: 0.7 });
    turned(Q, can(50, 22, 36, 1.8, 1.8), GLASS, { glass: true });
    turned(Q, can(50, 13, 25, 4.5, 4.5), GLASS, { glass: true, open: SKETCH.water });
    turned(Q, can(50, 10, 13, 5, 5), SKETCH.rubber, { strength: 0.7 });
    return;
  }
  // a Japanese dasher bottle, and a dropper bottle with its rubber bulb
  bottle({ shape: 'dasher', liquid: { hex: PANTRY.dark, alpha: 0.9 }, cap: STEEL, label: PANTRY.kraft, band: PANTRY.redApple }, { dx: -15, dy: 0, s: 0.9 }, 'dasher');
  const pl = { dx: 17, dy: 7, s: 0.7 };
  bottle({ shape: 'apothecary', liquid: { hex: PANTRY.amber, alpha: 0.85 }, glass: mixHex(PANTRY.amber, GLASS, 0.4), cap: SKETCH.rubber, label: PANTRY.kraft }, pl, 'dropper');
  const Q = placed(pl);
  Q.wash(oval(50, 12, 4.2, 8), SKETCH.rubber, 0.85, { ...CRISP, n: 10 });
  Q.soft(48.6, 9.5, 1, 3, 0, LIFT, 0.6);
  Q.line(closed(oval(50, 12, 4.2, 8)), { weight: 0.9 });
}
