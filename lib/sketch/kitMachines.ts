// Bar kit that plugs in or runs on gas (kit.ts): stick blenders and
// circulators, jug blenders and juicers, canisters (whipper, CO2, a Dewar, a
// smoke gun, a torch), appliance boxes, lab glass, superbags and hotel pans.
// Glass units, ground at 86.

import { PANTRY } from '@/constants/pantry';
import { SKETCH } from '@/constants/sketch';
import { ell, type Pt } from './geometry';
import { box, can, contents, CRISP, E, GLASS, latheRing, latheSil, onTop, rod, roundRect, STEEL, STEEL_DARK, turned, turnedLines, type Box, type Lathe } from './kitParts';
import type { KitCtx } from './kitTools';
import type { Painter } from './painter';
import { closed, oval, shadow } from './produce';
import { gauss, mixHex } from './random';
import { LIFT } from './styles';

const SMOOTHIE = mixHex(SKETCH.strawberry, SKETCH.white, 0.25);
const JUICE = mixHex(PANTRY.lime, SKETCH.white, 0.15);

/** A turned shape from a function of height (a dome, a sphere's side). */
const lathe = (cx: number, y0: number, y1: number, rOf: (t: number) => number, n = 16): Lathe => ({ cx, prof: Array.from({ length: n + 1 }, (_, i): Pt => [y0 + ((y1 - y0) * i) / n, rOf(i / n)]) });

/** Clear glass over whatever `inside` draws, with an optional fill. */
function glass(P: Painter, L: Lathe, inside: () => void = () => {}, fill?: { y: number; color: string; strength?: number }, open = true) {
  P.wash(latheSil(L), GLASS, 0.3, { n: 18, blooms: 0 });
  inside();
  if (fill) contents(P, L, fill.y, fill.color, fill.strength ?? 0.7);
  const [y0, y1] = [L.prof[0][0], L.prof[L.prof.length - 1][0]];
  const R = Math.max(...L.prof.map((p) => p[1]));
  P.soft(L.cx - R * 0.55, (y0 + y1) / 2, Math.max(0.8, R * 0.1), (y1 - y0) * 0.33, 0, LIFT, 0.6);
  turnedLines(P, L, 1, open);
}

/** A round flask: a ball of glass with a neck, part full. */
function roundFlask(P: Painter, cx: number, cy: number, R: number, liquid: string, neck: [Pt, Pt]) {
  rod(P, neck[0], neck[1], R * 0.24, GLASS, { strength: 0.3 });
  const ball = oval(cx, cy, R, R, 0, 30);
  P.wash(ball, GLASS, 0.3, { n: 16, blooms: 0 });
  P.wash([...ell(cx, cy + R * 0.2, R * 0.97, R * 0.25, Math.PI, Math.PI * 2, 12), ...ell(cx, cy, R * 0.97, R * 0.97, Math.asin(0.2), Math.PI - Math.asin(0.2), 16)], liquid, 0.8, { ...CRISP, n: 14 });
  P.soft(cx - R * 0.4, cy - R * 0.4, R * 0.25, R * 0.15, -0.6, LIFT, 0.7);
  P.line(closed(ball), { weight: 1 });
}

/** A conical flask: a narrow neck flaring to a wide flat base. */
const conical = (cx: number, y0: number, y1: number, neck: number, base: number): Lathe => ({ cx, prof: [[y0, neck], [y0 + (y1 - y0) * 0.32, neck], [y1 - 2.5, base], [y1, base - 0.6]] });

export function stick({ P, r, thumb, v }: KitCtx) {
  if (v === 'circulator') {
    // a sous vide circulator clipped to the back of a pot of water
    const pot = can(44, 50, 86 - 24 * E, 26, 24);
    rod(P, [19, 56], [10, 53.5], 1.8, STEEL, { metal: true, cap: true });
    turned(P, pot, STEEL, { metal: true, open: SKETCH.water });
    if (!thumb) for (const k of [0.5, 0.75]) P.line(ell(60, 46.5, 7 * k * 1.6, 7 * k * 0.45, 0.2, Math.PI * 2 - 0.2, 14), { weight: 0.4, alpha: 0.6, passes: 1 });
    turned(P, can(60, 30, 46.5, 5, 5), STEEL, { metal: true, open: false });
    turned(P, can(60, 9, 30, 6.4, 6.4), SKETCH.rubber, { strength: 0.8, lid: SKETCH.lcd });
    const clip: Pt[] = [[64, 38], [70, 38], [70, 49], [66, 49]];
    P.wash(clip, SKETCH.rubber, 0.8, { ...CRISP, n: 6 });
    P.line(closed(clip), { weight: 0.8 });
    shadow(P, r, 44, 28);
    return;
  }
  // a stick blender down in a jug
  const jug = can(46, 48, 86 - 16 * E, 17, 16);
  const handle: Pt[] = [[62.5, 52], [70, 53], [73, 58], [73, 70], [70, 75], [62, 77], [62.3, 73], [67, 72], [69, 68], [69, 60], [67, 57], [62.6, 56]];
  P.wash(handle, GLASS, 0.35, { ...CRISP, n: 10 });
  P.line(closed(handle), { weight: 0.9 });
  glass(P, jug, () => {
    turned(P, can(48, 36, 72, 2.2, 2.2), STEEL, { metal: true });
    turned(P, { cx: 48, prof: [[70, 3], [73, 7.5], [78, 8]] }, STEEL, { metal: true, open: true });
  }, { y: 58, color: SMOOTHIE, strength: 0.75 });
  const motor: Lathe = { cx: 48, prof: [[6, 6.5], [9, 7.6], [30, 7.6], [34, 6.6], [39, 4]] };
  turned(P, motor, SKETCH.enamel, { lid: SKETCH.rubber });
  P.wash(latheSil(motor, 13, 26), SKETCH.rubber, 0.7, { ...CRISP, n: 10 });
  P.glaze(oval(48, 17, 2, 1.6), SKETCH.butane, 0.9);
  P.line(latheRing(motor, 13), { weight: 0.6, passes: 1 });
  P.line(latheRing(motor, 26), { weight: 0.6, passes: 1 });
  shadow(P, r, 46, 20);
}

export function jug({ P, r, thumb, v }: KitCtx) {
  if (v === 'juicer') {
    // a centrifugal juicer: feed tube and pusher, a clear cover, juice running from the spout
    const cup = can(16, 70, 86 - 6 * E, 6.8, 6);
    glass(P, cup, () => {}, { y: 74, color: JUICE, strength: 0.8 });
    rod(P, [30, 62], [20, 66], 2.4, SKETCH.enamel, { cap: true });
    P.line([[19, 67], [18.6, 71]], { weight: 1.2, alpha: 0.8, passes: 1 });
    turned(P, can(46, 54, 86 - 21 * E, 20, 21), SKETCH.enamel, { lid: STEEL });
    const dome = lathe(46, 38, 54, (t) => 20 * Math.sqrt(Math.max(0.02, 1 - (1 - t) ** 2)));
    glass(P, dome, () => turned(P, can(46, 44, 53, 14, 12), STEEL, { metal: true, open: true }), undefined, false);
    glass(P, can(50, 22, 42, 6.6, 6.6), () => {});
    turned(P, can(50, 12, 26, 5.8, 5.8), SKETCH.enamel, { lid: SKETCH.rubber });
    if (!thumb) P.glaze(oval(36, 74, 3, 2.2), SKETCH.rubber, 0.8);
    shadow(P, r, 40, 30);
    return;
  }
  // a jug blender on its motor base
  const B: Box = { x0: 28, y0: 66, x1: 64, y1: 86, d: 18 };
  box(P, B, SKETCH.rubber, { strength: 0.8 });
  P.glaze(oval(46, 76, 4.4, 4.4), STEEL, 0.95);
  P.line(closed(oval(46, 76, 4.4, 4.4)), { weight: 0.9, passes: 1 });
  P.line([[46, 76], [48.5, 73]], { weight: 0.8, passes: 1, over: 0 });
  if (!thumb) for (const x of [33, 57]) P.wash(roundRect(x - 2, 74.5, x + 2, 77.5, 0.8), STEEL, 0.8, { ...CRISP, n: 6 });
  const [jx, jy] = onTop(B, 0.5, 0.5);
  turned(P, can(jx, jy - 7, jy, 12.5, 13), SKETCH.rubber, { strength: 0.8 });
  const jar: Lathe = { cx: jx, prof: [[14, 17], [30, 16], [jy - 7, 11.5]] };
  const handle: Pt[] = [[jx + 16.5, 20], [jx + 24, 22], [jx + 25, 28], [jx + 20, 48], [jx + 13, 51], [jx + 13.2, 47], [jx + 17, 45], [jx + 21, 29], [jx + 20, 25.5], [jx + 16.2, 24]];
  P.wash(handle, SKETCH.rubber, 0.7, { ...CRISP, n: 10 });
  P.line(closed(handle), { weight: 0.9 });
  glass(P, jar, () => {}, { y: 34, color: SMOOTHIE, strength: 0.8 });
  P.wash(latheSil(jar, 14, 18), SKETCH.rubber, 0.8, { ...CRISP, n: 10 });
  P.line(latheRing(jar, 18), { weight: 0.7, passes: 1 });
  shadow(P, r, 48, 22);
}

export function canister({ P, r, thumb, v, bottle }: KitCtx) {
  if (v === 'torch') {
    // a butane can with a torch head, and its blue flame
    const tin = can(36, 46, 86 - 12 * E, 12, 12);
    turned(P, tin, SKETCH.butane, { lid: STEEL });
    P.wash(latheSil(tin, 60, 72), SKETCH.white, 0.7, { ...CRISP, n: 10 });
    P.line(latheRing(tin, 60), { weight: 0.6, passes: 1 });
    P.line(latheRing(tin, 72), { weight: 0.6, passes: 1 });
    rod(P, [44, 40], [52, 50], 1.6, SKETCH.butane, { cap: true });
    turned(P, can(36, 33, 46, 7.5, 9), SKETCH.rubber, { strength: 0.8 });
    rod(P, [38, 37], [62, 26], 4, SKETCH.rubber, { strength: 0.8 });
    rod(P, [61, 26.5], [73, 21], 2, STEEL, { metal: true, cap: true });
    const d: Pt = [0.92, -0.4];
    const n: Pt = [0.4, 0.92];
    const tongue = (len: number, w: number): Pt[] => Array.from({ length: 21 }, (_, i): Pt => {
      const a = (i / 20) * Math.PI * 2;
      const t = (1 - Math.cos(a)) / 2;
      const half = Math.sin(a) * w * Math.sqrt(1 - t) * Math.min(1, t * 6 + 0.35);
      return [74.5 + d[0] * t * len + n[0] * half, 20.4 + d[1] * t * len + n[1] * half];
    });
    P.soft(84, 16, 9, 4, -0.4, SKETCH.flame, 0.3);
    P.glaze(tongue(20, 4.4), SKETCH.flame, 0.45, 3, 0.02);
    P.glaze(tongue(9, 2.2), mixHex(SKETCH.flame, SKETCH.white, 0.45), 0.85, 2, 0.02);
    P.line(tongue(20, 4.4), { weight: 0.45, alpha: 0.5, passes: 1 });
    shadow(P, r, 38, 16);
    return;
  }
  if (v === 'tank') {
    // a CO2 cylinder, a regulator with two gauges, and a hose to a bottle with a carbonation cap
    bottle({ shape: 'mixer', liquid: { hex: SKETCH.water, alpha: 0.15 }, cap: STEEL, label: null }, { dx: 23, dy: 6, s: 0.74 }, 'soda');
    const tank: Lathe = { cx: 34, prof: [[28, 4], [31, 8], [36, 12], [40, 13.5], [86 - 13.5 * E, 13.5]] };
    turned(P, tank, mixHex(SKETCH.rubber, STEEL, 0.35), { metal: true });
    turned(P, can(34, 21, 28, 3.4, 3.4), PANTRY.brassCap, { metal: true });
    rod(P, [32, 21], [50, 21], 3.4, PANTRY.brassCap, { metal: true, cap: true });
    P.line([[50, 22], [60, 23], [70, 30], [73, 36.8]], { weight: 2.2, wob: 0.8 });
    for (const [x, y] of [[40, 12], [55, 15]] as const) {
      P.glaze(oval(x, y, 5.6, 5.6), STEEL, 0.95);
      P.glaze(oval(x, y, 4.3, 4.3), SKETCH.white, 0.95);
      P.line([[x, y], [x + 2.4, y - 2]], { weight: 0.6, passes: 1, over: 0 });
      P.line(closed(oval(x, y, 5.6, 5.6)), { weight: 0.95 });
    }
    shadow(P, r, 40, 26);
    return;
  }
  if (v === 'dewar') {
    // a liquid nitrogen Dewar, its cap set loose, fog rolling off it
    const dewar: Lathe = { cx: 46, prof: [[30, 6], [34, 6.4], [38, 11], [43, 17], [48, 20.5], [54, 22], [76, 22], [80, 21], [86 - 20 * E, 20]] };
    turned(P, dewar, STEEL, { metal: true, open: true });
    for (let i = 0; i < (thumb ? 3 : 6); i++) P.soft(46 + gauss(r) * 3 + i * 1.5, 26 - i * 4, 5 + i * 1.6, 2.6 + i * 0.5, gauss(r) * 0.2, SKETCH.white, 0.7);
    P.soft(64, 40, 9, 3, 0.4, SKETCH.white, 0.6);
    if (!thumb) for (let k = 0; k < 3; k++) P.line(Array.from({ length: 12 }, (_, i): Pt => [44 + k * 3 + Math.sin(i * 0.9 + k) * 2, 26 - i * 1.8]), { weight: 0.4, alpha: 0.4, passes: 1, wob: 1.2 });
    turned(P, can(62, 26, 32, 7.5, 7, 0.5), SKETCH.rubber, { strength: 0.8 });
    rod(P, [24.5, 52], [17, 50], 1.6, STEEL, { metal: true, cap: true });
    shadow(P, r, 46, 24);
    return;
  }
  if (v === 'smoke') {
    // a smoke gun piping smoke under a glass cloche over a drink
    const board = oval(42, 80, 32, 7.5);
    P.wash([...ell(42, 80, 32, 7.5, 0, Math.PI, 16), ...ell(42, 83, 32, 7.5, Math.PI, 0, 16)], mixHex(PANTRY.wood, SKETCH.pool, 0.25), 0.9, { ...CRISP, n: 12 });
    P.wash(board, PANTRY.wood, 0.9, { n: 14, blooms: 0 });
    P.line(closed(board), { weight: 1 });
    P.line(ell(42, 83, 32, 7.5, 0, Math.PI, 16), { weight: 1 });
    const cloche = lathe(42, 34, 78, (t) => 22 * Math.sqrt(Math.max(0.03, 1 - (1 - t) ** 2)));
    glass(P, cloche, () => {
      glass(P, can(42, 62, 78 - 8 * E, 8.5, 8), () => {}, { y: 67, color: PANTRY.amber, strength: 0.9 });
      for (let i = 0; i < (thumb ? 3 : 6); i++) P.soft(42 + gauss(r) * 8, 54 - i * 3 + gauss(r) * 2, 10 + r() * 4, 4 + r() * 2, gauss(r) * 0.3, SKETCH.smudge, 0.35);
      if (!thumb) for (let k = 0; k < 3; k++) P.line(Array.from({ length: 14 }, (_, i): Pt => [30 + i * 1.8, 56 - k * 6 + Math.sin(i * 0.8 + k * 2) * 2]), { weight: 0.4, alpha: 0.4, passes: 1, wob: 1.2 });
    }, undefined, false);
    turned(P, can(42, 30, 35, 2.8, 2.8), GLASS, { glass: true });
    P.line([[74, 50], [72, 62], [66, 74], [60, 79]], { weight: 1.8, wob: 0.8 });
    turned(P, can(78, 40, 52, 4.6, 4.6), STEEL, { metal: true, open: true });
    rod(P, [78, 52], [86, 70], 2.8, SKETCH.rubber, { cap: true, strength: 0.8 });
    rod(P, [74.5, 47], [71, 47], 1.2, STEEL, { cap: true });
    return;
  }
  // a cream whipper and a charger
  rod(P, [66, 83], [80, 79], 3.2, STEEL, { metal: true });
  rod(P, [80, 79], [84, 78], 1.2, STEEL, { metal: true, cap: true });
  const body = can(44, 32, 86 - 11 * E, 11, 11);
  turned(P, body, STEEL, { metal: true, lid: STEEL });
  turned(P, { cx: 44, prof: [[18, 6], [24, 9.5], [32, 11.4]] }, mixHex(STEEL, STEEL_DARK, 0.35), { metal: true });
  P.line(latheRing(body, 34), { weight: 0.6, passes: 1 });
  rod(P, [50, 20], [64, 13], 1.6, SKETCH.rubber, { cap: true, strength: 0.8 });
  turned(P, { cx: 44, prof: [[8, 1.6], [12, 3.2], [18, 4]] }, STEEL, { metal: true });
  if (!thumb) for (const x of [-1.6, 0, 1.6]) P.line([[44 + x, 9], [44 + x * 1.6, 17]], { weight: 0.4, passes: 1, over: 0 });
  shadow(P, r, 50, 20);
}

export function appliance({ P, r, thumb, v }: KitCtx) {
  if (v === 'plate') {
    // a stirrer hot plate spinning a vortex in a conical flask
    const B: Box = { x0: 14, y0: 74, x1: 70, y1: 86, d: 34 };
    box(P, B, SKETCH.enamel, { top: SKETCH.white });
    for (const x of [24, 60]) { P.glaze(oval(x, 80, 3.4, 3.4), STEEL, 0.95); P.line(closed(oval(x, 80, 3.4, 3.4)), { weight: 0.8, passes: 1 }); }
    const [fx, fy] = onTop(B, 0.5, 0.5);
    const flask = conical(fx, 26, fy, 4.5, 16);
    glass(P, flask, () => rod(P, [fx - 4, fy - 1.5], [fx + 4, fy - 1.5], 1.2, SKETCH.white, { cap: true }), { y: 50, color: mixHex(PANTRY.raspberry, SKETCH.white, 0.3), strength: 0.6 });
    if (!thumb) for (const k of [0.3, 0.55, 0.8]) P.line(ell(fx, 50 + k * 4, 11 * k, 2.4 * k, 0.4, Math.PI * 2 - 0.4, 16), { weight: 0.45, alpha: 0.6, passes: 1 });
    shadow(P, r, 46, 34);
    return;
  }
  if (v === 'cooler') {
    box(P, { x0: 14, y0: 54, x1: 70, y1: 86, d: 30 }, SKETCH.ceramicGlaze);
    box(P, { x0: 12.5, y0: 47, x1: 71.5, y1: 55, d: 32 }, SKETCH.enamel);
    const latch = roundRect(38, 53, 46, 60, 1);
    P.wash(latch, SKETCH.enamel, 0.9, { ...CRISP, n: 6 });
    P.line(closed(latch), { weight: 0.8, passes: 1 });
    P.line([[74, 62], [79, 57], [86, 55], [86, 64], [78.5, 68.5]], { weight: 1.3 });
    shadow(P, r, 46, 34);
    return;
  }
  if (v === 'dryer') {
    // a freeze dryer: a tall box with a round porthole door
    box(P, { x0: 18, y0: 22, x1: 62, y1: 86, d: 28 }, SKETCH.enamel);
    screen(P, 30, 28, 50, 34);
    P.glaze(oval(40, 58, 15, 15), STEEL, 0.95);
    P.glaze(oval(40, 58, 11, 11), mixHex(GLASS, SKETCH.pool, 0.45), 0.9);
    if (!thumb) for (const y of [52, 58, 64]) P.line([[31 + Math.abs(58 - y) * 0.5, y], [49 - Math.abs(58 - y) * 0.5, y]], { weight: 0.5, alpha: 0.7, passes: 1 });
    P.soft(36, 53, 4, 2.4, -0.6, LIFT, 0.7);
    P.line(closed(oval(40, 58, 15, 15)), { weight: 1.05 });
    P.line(closed(oval(40, 58, 11, 11)), { weight: 0.8 });
    shadow(P, r, 44, 30);
    return;
  }
  if (v === 'trays') {
    // a dehydrator, orange wheels drying on its trays behind a clear door
    const B: Box = { x0: 16, y0: 36, x1: 64, y1: 86, d: 32 };
    box(P, B, SKETCH.enamel);
    const door = roundRect(20, 40, 60, 82, 1.6);
    P.wash(door, mixHex(GLASS, SKETCH.pool, 0.3), 0.75, { ...CRISP, n: 12 });
    for (const y of thumb ? [52, 66, 78] : [48, 56, 64, 72, 80]) {
      P.line([[21, y], [59, y]], { weight: 0.5, alpha: 0.8, passes: 1 });
      for (const x of [27, 40, 53]) { P.glaze(oval(x, y - 1.2, 4.6, 1.5), SKETCH.orangeWheel, 0.95); if (!thumb) P.line(closed(oval(x, y - 1.2, 4.6, 1.5)), { weight: 0.4, passes: 1 }); }
    }
    P.soft(28, 46, 4, 2, -0.3, LIFT, 0.5);
    P.line(closed(door), { weight: 0.9 });
    rod(P, [36, 39], [44, 39], 0.9, STEEL, { cap: true });
    shadow(P, r, 44, 30);
    return;
  }
  if (v === 'spin') {
    // a benchtop centrifuge: a squat body, the rotor under a clear domed lid
    const B: Box = { x0: 14, y0: 60, x1: 66, y1: 86, d: 32 };
    box(P, B, SKETCH.enamel);
    screen(P, 22, 66, 38, 72);
    P.glaze(oval(54, 73, 4, 4), STEEL, 0.95);
    P.line(closed(oval(54, 73, 4, 4)), { weight: 0.8, passes: 1 });
    const [cx, cy] = onTop(B, 0.5, 0.5);
    const dome = lathe(cx, cy - 15, cy, (t) => 21 * Math.sqrt(Math.max(0.03, 1 - (1 - t) ** 2)));
    glass(P, dome, () => turned(P, can(cx, cy - 5, cy, 15, 15), STEEL, { metal: true, lid: mixHex(STEEL, STEEL_DARK, 0.3) }), undefined, false);
    shadow(P, r, 44, 30);
    return;
  }
  // a chamber vacuum sealer, a sealed bag of fruit under its clear lid
  const B: Box = { x0: 12, y0: 58, x1: 66, y1: 86, d: 40 };
  box(P, B, STEEL);
  const lid = [onTop(B, 0.06, 0.1), onTop(B, 0.94, 0.1), onTop(B, 0.94, 0.9), onTop(B, 0.06, 0.9)];
  P.wash(lid, mixHex(GLASS, SKETCH.pool, 0.3), 0.6, { ...CRISP, n: 10 });
  const pouch = [onTop(B, 0.22, 0.25), onTop(B, 0.72, 0.25), onTop(B, 0.72, 0.75), onTop(B, 0.22, 0.75)];
  P.wash(pouch, SKETCH.white, 0.6, { ...CRISP, n: 8 });
  P.wash(oval(...onTop(B, 0.45, 0.5), 8, 3.4, -0.3), SKETCH.berry, 0.85, { ...CRISP, n: 10 });
  P.line(closed(pouch), { weight: 0.6, passes: 1 });
  P.soft(...onTop(B, 0.3, 0.6), 10, 2.4, -0.55, LIFT, 0.6);
  P.line(closed(lid), { weight: 0.8 });
  screen(P, 40, 64, 60, 71);
  shadow(P, r, 46, 34);
}

/** A dark panel with a pale strip, for appliances (no reading). */
function screen(P: Painter, x0: number, y0: number, x1: number, y1: number) {
  const f = roundRect(x0, y0, x1, y1, 1);
  P.glaze(f, SKETCH.rubber, 0.85);
  P.glaze(roundRect(x0 + 1.2, y0 + 1.2, x0 + (x1 - x0) * 0.55, y1 - 1.2, 0.5), SKETCH.lcd, 0.95);
  P.line(closed(f), { weight: 0.7, passes: 1 });
}

export function flask({ P, r, thumb, v }: KitCtx) {
  if (v === 'rotovap') {
    // a rotary evaporator: the flask turning in a warm bath, the condenser, and the catch flask
    rod(P, [88, 86], [88, 8], 1.3, STEEL, { metal: true, cap: true });
    const bath = can(30, 66, 86 - 20 * E, 20, 19);
    turned(P, bath, STEEL, { metal: true, open: SKETCH.water });
    roundFlask(P, 30, 61, 12, mixHex(PANTRY.amber, SKETCH.white, 0.2), [[37, 52], [52, 39]]);
    rod(P, [50, 41], [62, 31], 6, SKETCH.enamel, { cap: true });
    const cond = can(70, 8, 52, 5, 5);
    glass(P, cond, () => {
      if (!thumb) P.line(Array.from({ length: 60 }, (_, i): Pt => [70 + Math.sin(i * 0.9) * 3.4, 12 + i * 0.62]), { weight: 0.45, alpha: 0.7, passes: 1, wob: 0.3 });
      else P.line([[70, 12], [70, 48]], { weight: 0.5, passes: 1 });
    });
    P.line([[62, 31], [65, 31]], { weight: 1.2 });
    roundFlask(P, 72, 72, 10, mixHex(SKETCH.water, SKETCH.white, 0.3), [[70, 52], [71, 63]]);
    P.line([[86.8, 70], [80, 70]], { weight: 1 });
    shadow(P, r, 48, 34);
    return;
  }
  // vacuum filtration: a Büchner funnel in a side-arm flask, the hose to the pump
  P.line([[63, 42], [72, 44], [80, 54], [84, 72], [90, 82]], { weight: 2.2, wob: 0.8 });
  const fl = conical(42, 34, 86 - 21 * E, 6, 21);
  glass(P, fl, () => turned(P, can(42, 34, 50, 2, 1.6), SKETCH.white, {}), { y: 68, color: mixHex(PANTRY.gold, SKETCH.white, 0.2), strength: 0.6 });
  rod(P, [47, 42], [63, 41], 1.6, GLASS, { strength: 0.4, cap: true });
  turned(P, can(42, 28, 35, 6.8, 5.8), SKETCH.rubber, { strength: 0.8 });
  turned(P, { cx: 42, prof: [[24, 12.5], [28, 4], [30, 2.4]] }, SKETCH.enamel, {});
  turned(P, can(42, 10, 24, 14, 12.5), SKETCH.enamel, { open: mixHex(SKETCH.white, SKETCH.lift, 0.5) });
  if (!thumb) P.dots(Array.from({ length: 12 }, (_, i) => [42 + Math.cos(i) * (i % 3) * 3.6, 10.6 + Math.sin(i) * (i % 3) * 0.9, 0.4] as [number, number, number]), STEEL_DARK, 0.4);
  shadow(P, r, 42, 24);
}

export function bag({ P, r, thumb }: KitCtx) {
  // a superbag hung by its drawstring, dripping into a steel bowl
  const bowl: Lathe = { cx: 46, prof: [[68, 26], [73, 24], [79, 19], [86 - 11 * E, 11]] };
  turned(P, bowl, STEEL, { metal: true, open: mixHex(SKETCH.berry, SKETCH.white, 0.4) });
  for (const [x, y] of [[47, 62], [45.5, 66.5]] as const) {
    const drop: Pt[] = [[x, y - 2.2], [x + 1, y], [x, y + 1.1], [x - 1, y]];
    P.wash(drop, SKETCH.berry, 0.7, { ...CRISP, n: 6 });
  }
  const sack: Lathe = { cx: 46, prof: [[18, 15], [28, 16.5], [40, 15], [50, 10.5], [56, 5], [58, 1]] };
  P.wash(latheSil(sack), SKETCH.capFoam, 0.7, { n: 16 });
  contents(P, sack, 40, SKETCH.berry, 0.75);
  if (!thumb) {
    P.b.begin(latheSil(sack).map(P.U));
    for (let k = -10; k <= 10; k++) for (const s of [-1, 1]) P.line([[46 + k * 3, 14], [46 + k * 3 + s * 46, 62]], { weight: 0.35, alpha: 0.3, passes: 1, over: 0 });
    P.b.end();
  }
  turnedLines(P, sack, 1, false);
  const hem = can(46, 15, 18.5, 15.6, 15.3);
  turned(P, hem, SKETCH.white, { open: mixHex(SKETCH.capFoam, SKETCH.pool, 0.2) });
  for (const s of [-1, 1]) P.line([[46 + s * 14, 15], [46 + s * 6, 7], [46, 3]], { weight: 0.7, passes: 1, wob: 0.6 });
  P.line([[46, 3], [44, 0]], { weight: 0.8, passes: 1 });
  shadow(P, r, 46, 22);
}

export function pan({ P, r, thumb }: KitCtx) {
  // a perforated hotel pan: lip, sloped sides, holes in the floor and walls
  const p = (x: number, y: number, z: number): Pt => [12 + x + z * 0.55, 82 - y - z * 0.36];
  const rim = [p(-2, 14, -2), p(56, 14, -2), p(56, 14, 40), p(-2, 14, 40)];
  const lip = [p(-5, 14, -5), p(59, 14, -5), p(59, 14, 43), p(-5, 14, 43)];
  const flo = [p(4, 0, 4), p(50, 0, 4), p(50, 0, 34), p(4, 0, 34)];
  P.wash(lip, mixHex(STEEL, SKETCH.white, 0.3), 0.9, { ...CRISP, n: 10 });
  P.wash(rim, mixHex(STEEL, STEEL_DARK, 0.4), 0.9, { ...CRISP, n: 12 });
  P.wash([rim[3], rim[2], flo[2], flo[3]], STEEL, 0.8, { ...CRISP, n: 10 });
  P.wash(flo, mixHex(STEEL, SKETCH.white, 0.2), 0.8, { ...CRISP, n: 10 });
  const holes: [number, number, number][] = [];
  const step = thumb ? 9 : 4.5;
  for (let x = 8; x <= 46; x += step) for (let z = 8; z <= 30; z += step) holes.push([...p(x, 0, z), thumb ? 0.9 : 0.6]);
  for (let x = 6; x <= 50; x += step) for (let y = 3; y <= 11; y += step) holes.push([...p(x, y, 40 - y * 0.43), thumb ? 0.9 : 0.6]);
  P.dots(holes, STEEL_DARK, 0.7);
  P.wash([rim[0], rim[1], flo[1], flo[0]], STEEL, 0.95, { n: 12 });
  P.wash([rim[1], rim[2], flo[2], flo[1]], mixHex(STEEL, STEEL_DARK, 0.45), 0.9, { ...CRISP, n: 10 });
  const front: [number, number, number][] = [];
  for (let x = 6; x <= 50; x += step) for (let y = 3; y <= 11; y += step) front.push([...p(x, y, -2 + (14 - y) * 0.43), thumb ? 0.9 : 0.6]);
  P.dots(front, STEEL_DARK, 0.6);
  P.soft(...p(18, 8, -1), 12, 2, -0.1, LIFT, 0.6);
  P.line(closed(lip), { weight: 1 });
  P.line(closed(rim), { weight: 0.8 });
  P.line([rim[0], flo[0], flo[1], rim[1]], { weight: 1 });
  P.line([flo[1], flo[2], rim[2]], { weight: 0.9 });
  P.line([rim[3], flo[3], flo[2]], { weight: 0.5, alpha: 0.6, passes: 1 });
  shadow(P, r, 46, 34, 86);
}
