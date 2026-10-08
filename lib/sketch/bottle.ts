// An ingredient's drawn bottle, in the same hand as the drinks (painter.ts):
// a few half-erased tries at the outline, the liquid in watercolour, a paper
// label with pencil lettering, a dark cap, and the graphite line on top.
// Deterministic: the same ingredient and seed always draw the same way.

import { SKETCH } from '@/constants/sketch';
import { band, ell, hw, type GlassShape, type Pt } from './geometry';
import { makePainter, type LineOpts, type Painter, type Place } from './painter';
import { gauss, hashString, mixHex, rng, type Rng } from './random';
import { SceneBuilder, type Scene } from './scene';
import { DEFAULT_SKETCH_STYLE, LIFT, SKETCH_STYLES, SMUDGE, type SketchStyle } from './styles';

interface BottleShape {
  /** Lip at the top, then neck, shoulder and body: [y, half-width], top to bottom. */
  prof: Pt[];
  /** The cap or cork runs from the lip down this far. */
  cap: number;
  /** Where the liquid starts. */
  fill: number;
  /** The front label, top and bottom. */
  label: [number, number];
  /** No label (a milk bottle). */
  plain?: boolean;
}

// Generic families, not makers' bottles. Body width ~12-18 so they read at
// the same size as the drinks.
export const BOTTLE_SHAPES = {
  // vodka, white rum, most spirits
  tall: { prof: [[9, 3.7], [20, 3.7], [27, 4], [32, 7], [37, 11], [41, 13.2], [44, 13.8], [88, 13.8], [90, 13.2]], cap: 19, fill: 40, label: [55, 76] },
  // gin: short neck, broad shoulders
  gin: { prof: [[17, 4.8], [24, 4.8], [26, 7], [28, 12], [30.5, 15.4], [32, 16], [88, 16], [90, 15.4]], cap: 24, fill: 33, label: [48, 74] },
  // agave and pot-still rum: long neck on a squat body
  squat: { prof: [[8, 3.1], [18, 3.1], [36, 3.3], [41, 6.5], [47, 12], [52, 15.2], [55, 15.8], [88, 15.8], [90, 15]], cap: 17, fill: 52, label: [62, 80] },
  // wine, vermouth, amari
  longneck: { prof: [[6, 3.3], [16, 3.3], [28, 3.6], [35, 7], [42, 11.2], [47, 12.4], [88, 12.4], [90, 11.8]], cap: 15, fill: 44, label: [57, 80] },
  // cognac, aged rum, liqueur
  decanter: { prof: [[14, 4.2], [22, 4.2], [28, 4], [33, 8], [40, 14], [48, 17.8], [60, 18.6], [72, 17.2], [82, 14.2], [90, 11]], cap: 22, fill: 42, label: [52, 70] },
  // bitters: a dasher with a long paper wrap
  dasher: { prof: [[30, 3.5], [37, 3.5], [41, 3.6], [45, 7.5], [48.5, 10], [50, 10.4], [88, 10.4], [90, 10]], cap: 37, fill: 49, label: [51, 87] },
  // tonic, soda, ginger beer
  mixer: { prof: [[22, 2.9], [26, 2.9], [40, 3.6], [50, 7], [57, 8.8], [60, 9], [88, 9], [90, 8.6]], cap: 25, fill: 56, label: [64, 82] },
  beer: { prof: [[10, 2.9], [16, 2.9], [32, 4.2], [41, 8], [47, 10.2], [88, 10.2], [90, 9.8]], cap: 16, fill: 42, label: [58, 78] },
  // honey, jam, marmalade, pickles
  jar: { prof: [[36, 13.5], [41, 13.5], [42, 15.6], [44, 16.6], [87, 16.6], [90, 16]], cap: 41, fill: 47, label: [55, 78] },
  // house syrups, cordials, shrubs, tinctures: corked, with a kraft label
  apothecary: { prof: [[20, 4.4], [29, 4.4], [32, 4.2], [35, 8], [39, 12], [42, 13], [88, 13], [90, 12.6]], cap: 29, fill: 45, label: [56, 76] },
  // milk and cream
  milk: { prof: [[14, 7.2], [17, 7.2], [19, 6.6], [28, 8.6], [38, 12.6], [46, 14.2], [88, 14.2], [90, 13.6]], cap: 17, fill: 22, label: [0, 0], plain: true },
} satisfies Record<string, BottleShape>;

export type BottleShapeKey = keyof typeof BOTTLE_SHAPES;

export interface BottleInputs {
  shape: BottleShapeKey;
  /** The liquid; alpha below 0.2 reads as clear. */
  liquid: { hex: string; alpha: number };
  /** Tinted glass (green, amber), or null for clear glass. */
  glass?: string | null;
  cap?: string | null;
  /** The label's paper, and an optional band of colour across it. */
  label?: string | null;
  band?: string | null;
}

const asGlass = (b: BottleShape): GlassShape => ({ rim: b.prof[0][0], prof: b.prof, top: b.fill, base: 87, stemmed: false });

/** The outline: lip, both sides, and the base. */
function parts(P: Painter): [Pt[], LineOpts][] {
  const { g, e, Rr, bot } = P;
  const R: Pt[] = [];
  const L: Pt[] = [];
  for (let y = g.rim; y <= bot; y += 1) {
    R.push([50 + hw(g, y), y]);
    L.push([50 - hw(g, y), y]);
  }
  const Rb = hw(g, bot);
  return [
    [ell(50, g.rim, Rr, Rr * e * 1.6, -0.35, Math.PI * 2 + 0.15, 24), { weight: 0.9 }],
    [R, { weight: 1.1 }],
    [L, { weight: 1.1 }],
    [ell(50, bot, Rb, Rb * e, 0, Math.PI, 36), { weight: 1.3, passes: P.S.passes + 1 }],
  ];
}

/** Earlier tries at the outline, half rubbed out. */
function searching(P: Painter, outline: [Pt[], LineOpts][], body: number, r: Rng) {
  const { S, g, bot } = P;
  for (let i = 0; i < S.ghosts; i++) {
    const dx = gauss(r) * 1.8;
    const dy = gauss(r) * 1.2;
    const sc = 1 + gauss(r) * 0.035;
    const T = ([x, y]: Pt): Pt => [50 + (x - 50) * sc + dx, 52 + (y - 52) * sc + dy];
    for (const [p] of outline) if (r() >= 0.3) P.line(p.map(T), { weight: 0.7, alpha: (0.34 + r() * 0.2) * S.ghostA, passes: 1, gaps: 1.4, wob: 1.6, over: 8 });
  }
  P.line([[50, g.rim - 6], [50, bot + 5]], { weight: 0.45, alpha: S.construct * 1.4, passes: 1, gaps: 0.6, over: 0 });
  for (let i = 0; i < 2; i++) P.soft(50 + gauss(r) * body * 0.4, g.rim + (bot - g.rim) * (0.35 + r() * 0.4), body * (0.9 + r() * 0.4), body * (0.5 + r() * 0.3), gauss(r) * 0.3, SMUDGE, (0.05 * S.ghosts) / 3);
  for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
    const yy = g.rim + r() * (bot - g.rim);
    const ex = 50 + (r() < 0.5 ? -1 : 1) * (hw(g, yy) + gauss(r) * 2);
    P.soft(ex, yy, 5 + r() * 6, 2 + r() * 2, gauss(r) * 0.3, LIFT, 0.5 + r() * 0.25);
  }
}

/** A line of pencil lettering across the front of the label, following its curve. */
function lettering(P: Painter, y: number, half: number, weight: number, r: Rng) {
  const R = hw(P.g, y);
  const pts: Pt[] = [];
  for (let x = -half; x <= half; x += 0.8) pts.push([50 + x, y + Math.sqrt(Math.max(0, 1 - (x / R) ** 2)) * R * P.e + Math.sin(x * 2.3 + r() * 6) * 0.35 * weight]);
  P.line(pts, { weight, alpha: 0.85, passes: 1, wob: 0.5, over: 0, gaps: 0.1 });
}

/** The house hand, lighter for small tiles. */
export function handFor(detail: 'full' | 'thumb'): SketchStyle {
  const base = SKETCH_STYLES[DEFAULT_SKETCH_STYLE];
  return detail === 'thumb' ? { ...base, ghosts: 0, construct: 0, hatch: 0, blooms: 0, passes: 2, layers: base.layers * 0.6 } : base;
}

export function paintBottle(inputs: BottleInputs, { seed, detail = 'full' }: { seed: string; detail?: 'full' | 'thumb' }): Scene {
  const b = new SceneBuilder(`b${hashString(seed).toString(36)}`);
  drawBottle(b, handFor(detail), inputs, seed, detail);
  return b.done();
}

/** Draws a bottle into a scene, optionally moved and scaled (set behind a still life). */
export function drawBottle(b: SceneBuilder, S: SketchStyle, inputs: BottleInputs, seed: string, detail: 'full' | 'thumb', place?: Place) {
  const shape: BottleShape = BOTTLE_SHAPES[inputs.shape];
  const key = `${seed}|bottle`;
  const r = rng(hashString(key));
  const g = asGlass(shape);
  const P = makePainter(S, r, rng(hashString(`${key}|hand`)), b, g, place);
  const { bot } = P;
  const body = Math.max(...shape.prof.map((p) => p[1]));
  const outline = parts(P);
  if (S.ghosts) searching(P, outline, body, rng(hashString(`${key}|search`)));

  // --- glass and liquid ---
  if (inputs.glass) P.wash(P.silhouette, inputs.glass, 0.55, { spill: 0.15, fadeTo: 0.45, blooms: 0.5 });
  const clear = inputs.liquid.alpha < 0.2;
  const tone = mixHex(clear ? mixHex(inputs.liquid.hex, SKETCH.glassGrey, 0.4) : inputs.liquid.hex, SKETCH.mute, S.mute);
  const strength = clear ? 0.3 : Math.min(1.1, 0.5 + inputs.liquid.alpha * 0.6);
  P.wash(band(g, shape.fill, g.base!), tone, strength);
  P.wash(band(g, shape.fill + (g.base! - shape.fill) * 0.5, g.base!), mixHex(tone, SKETCH.pool, 0.15), strength * 0.3, { layers: 0.5, spill: 0.4, fadeAngle: -Math.PI / 2, fadeTo: 0, blooms: 0.3 });

  // --- label: paper, a band of colour, pencil lettering ---
  const [l0, l1] = shape.label;
  if (!shape.plain) {
  const paper = inputs.label ?? SKETCH.capFoam;
  P.glaze(band(g, l0, l1, 0.3), paper, 0.92, 3, 0.02);
  if (inputs.band) P.wash(band(g, l1 - (l1 - l0) * 0.24, l1 - (l1 - l0) * 0.1, 0.5), inputs.band, 0.85, { layers: 0.45, spill: 0, blooms: 0, misreg: 0.08, v1: 0.05, v2: 0.04 });
  const lw = hw(g, l0);
  if (detail === 'full') {
    const lr = rng(hashString(`${key}|label`));
    lettering(P, l0 + (l1 - l0) * 0.3, lw * (0.5 + lr() * 0.15), 1.5, lr);
    lettering(P, l0 + (l1 - l0) * 0.5, lw * (0.32 + lr() * 0.12), 0.6, lr);
    lettering(P, l0 + (l1 - l0) * 0.62, lw * (0.4 + lr() * 0.12), 0.5, lr);
  }
  for (const y of [l0, l1]) {
    const R = hw(g, y) - 0.2;
    P.line(ell(50, y, R, R * P.e, 0.05, Math.PI - 0.05, 24), { weight: 0.75, alpha: 0.9, gaps: 0.4 });
  }
  }

  // --- cap ---
  P.wash(band(g, g.rim + 0.4, shape.cap, 0.4), inputs.cap ?? SKETCH.charcoal, 0.8, { layers: 0.5, spill: 0, blooms: 0, misreg: 0.05, v1: 0.05, v2: 0.04, fadeTo: 0.6 });
  const Rc = hw(g, shape.cap) + 0.3;
  P.line(ell(50, shape.cap, Rc, Rc * P.e * 1.6, 0.1, Math.PI - 0.1, 14), { weight: 0.8 });

  // --- shadow, then the pencil on top ---
  P.soft(50 + body * 0.25, bot + 1.4, body * 1.3, (4 * (1 + S.shadow)) / P.k, 0, S.ink, 0.1 * S.shadow);
  for (let i = 0; i < Math.round(6 + 10 * S.shadow); i++) {
    const y = bot + 0.6 + r() * 2.4;
    P.line([[50 - body * (0.6 + r() * 0.5), y], [50 + body * (0.9 + r() * 0.9), y + gauss(r) * 0.3]], { passes: 1, alpha: 0.35 * S.shadow, weight: 0.45, wob: 0.4, gaps: 0.3, over: 4 });
  }
  for (const [p, o] of outline) P.line(p, o);
  // where the shoulder turns, and the liquid's surface
  const Rf = hw(g, shape.fill);
  P.line(ell(50, shape.fill, Rf, Rf * P.e, 0.1, Math.PI - 0.1, 24), { weight: 0.6, alpha: clear ? 0.45 : 0.75, gaps: 0.6 });
  if (S.hatch) P.hatch(band(g, shape.cap, bot), 50 + body * 0.3, -1.05, S.hatch);
  // the glint down the glass
  P.line([[50 - body * 0.62, Math.max(shape.fill, shape.cap + 8) + 4], [50 - body * 0.6, shape.fill + (bot - shape.fill) * 0.45]], { passes: 1, weight: 0.45, alpha: 0.45, gaps: 0.5 });
}
