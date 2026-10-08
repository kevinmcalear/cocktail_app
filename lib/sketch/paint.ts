// A drink's drawn sketch, from its drawing inputs: the glass found in a few
// half-erased tries, a watercolour wash of the drink's own colour, its foam,
// ice and garnish, and a thin, wobbly graphite outline. Deterministic: the
// same drink and seed always draw the same way.
//
// Ported from the browser prototype in the "Stained Sketches" artifact; the
// canvas-only steps (blend modes, erasing) become layered translucent shapes,
// gradient fades and paper-coloured lifts so react-native-svg can draw it on
// every platform.

import { SKETCH } from '@/constants/sketch';
import { band, ell, glassShape, hw, type Pt } from './geometry';
import { paintGarnish } from './garnish';
import { paintIce } from './ice';
import { makePainter, type LineOpts, type Painter } from './painter';
import { gauss, hashString, mixHex, rng, type Rng } from './random';
import { SceneBuilder, type Scene } from './scene';
import { CRUMB, DEFAULT_SKETCH_STYLE, LIFT, SKETCH_STYLES, SMUDGE, type SketchStyleKey } from './styles';
import type { SketchFoam, SketchInputs } from './types';

const FOAM: Record<SketchFoam, { depth: number; rise: number; bubbles: number }> = {
  cap: { depth: 7.5, rise: 2.4, bubbles: 70 },
  crema: { depth: 6, rise: 1.6, bubbles: 55 },
  froth: { depth: 4.8, rise: 1, bubbles: 50 },
  silk: { depth: 3.6, rise: 0.7, bubbles: 30 },
  sheen: { depth: 2.4, rise: 0.3, bubbles: 34 },
};

/** The glass's strokes, reused by the searching passes. */
function glassParts(P: Painter): [Pt[], LineOpts][] {
  const { g, e, Rr, bot, S } = P;
  const out: [Pt[], LineOpts][] = [];
  const R: Pt[] = [];
  const L: Pt[] = [];
  for (let y = g.rim; y <= bot; y += 1) {
    R.push([50 + hw(g, y), y]);
    L.push([50 - hw(g, y), y]);
  }
  out.push([ell(50, g.rim, Rr, Rr * e, -0.35, Math.PI * 2 + 0.15, 64), { weight: 1 }], [R, { weight: 1.1 }], [L, { weight: 1.1 }]);
  if (g.stemmed) {
    const [s0, s1] = g.stem!;
    const [fy, fr] = g.foot!;
    const sw = g.stemW ?? 1.3;
    const fl = g.flare ?? 5;
    const ex = g.stemW ? 9 : 6;
    const stem = (side: number) => {
      const o: Pt[] = [];
      for (let y = s0; y <= s1; y += 1) {
        const t = (y - s0) / (s1 - s0);
        o.push([50 + side * (sw + Math.pow(t, ex) * fl + Math.pow(1 - t, 10) * 1.2), y]);
      }
      return o;
    };
    out.push([stem(1), { weight: 0.9 }], [stem(-1), { weight: 0.9 }]);
    out.push([ell(50, fy, fr, fr * 0.18, -0.2, Math.PI * 2 + 0.1, 48), { weight: 0.95 }]);
    out.push([ell(50, fy + 0.6, fr, fr * 0.18, 0.15, Math.PI - 0.15, 30), { weight: 1.25, passes: S.passes + 1 }]);
  } else {
    const Rb = hw(g, bot);
    out.push([ell(50, bot, Rb, Rb * e, 0, Math.PI, 36), { weight: 1.3, passes: S.passes + 1 }]);
    out.push([ell(50, g.base!, Rb - 1.4, (Rb - 1.4) * e, 0.1, Math.PI - 0.1, 30), { weight: 0.7, alpha: 0.8 }]);
  }
  return out;
}

/** Earlier tries at the shape, half rubbed out, with guide ellipses and eraser marks. */
function searching(P: Painter, parts: [Pt[], LineOpts][], r: Rng) {
  const { S, g, e, Rr, bot } = P;
  for (let i = 0; i < S.ghosts; i++) {
    const dx = gauss(r) * 2.2;
    const dy = gauss(r) * 1.4;
    const sc = 1 + gauss(r) * 0.045;
    const sx = 1 + gauss(r) * 0.035;
    const T = ([x, y]: Pt): Pt => [50 + (x - 50) * sc * sx + dx, 52 + (y - 52) * sc + dy];
    for (const [p] of parts) if (r() >= 0.25) P.line(p.map(T), { weight: 0.7, alpha: (0.38 + r() * 0.22) * S.ghostA, passes: 1, gaps: 1.4, wob: 1.7, over: 8 });
  }
  const fy = g.stemmed ? g.foot![0] : bot;
  const fr = g.stemmed ? g.foot![1] : hw(g, bot);
  P.line(ell(50, g.rim + gauss(r) * 0.6, Rr * 1.03, Rr * e * 1.2, 0, Math.PI * 2, 48), { weight: 0.5, alpha: 0.3, passes: 1, gaps: 1.5, wob: 1.4, over: 0 });
  P.line(ell(50, fy, fr * 1.05, fr * 0.22, 0, Math.PI * 2, 40), { weight: 0.5, alpha: 0.28, passes: 1, gaps: 1.5, wob: 1.2, over: 0 });
  P.line([[50 - Rr - 2, g.rim - 3], [50 - Rr * 0.35, fy + 4]], { weight: 0.45, alpha: 0.2, passes: 1, gaps: 0.8, over: 4 });
  P.line([[50 + Rr + 2, g.rim - 3], [50 + Rr * 0.35, fy + 4]], { weight: 0.45, alpha: 0.2, passes: 1, gaps: 0.8, over: 4 });
  for (let i = 0; i < 2; i++) P.soft(50 + gauss(r) * Rr * 0.5, g.rim + (fy - g.rim) * (0.25 + r() * 0.5), Rr * (0.9 + r() * 0.5), Rr * (0.45 + r() * 0.3), gauss(r) * 0.3, SMUDGE, (0.06 * S.ghosts) / 3);
  const crumbs: [number, number, number][] = [];
  const nE = Math.round((1.4 + r() * 1.2) * S.ghosts);
  for (let i = 0; i < nE; i++) {
    const yy = g.rim - 2 + r() * (fy - g.rim + 3);
    const ex = 50 + (r() < 0.5 ? -1 : 1) * (hw(g, Math.min(yy, bot)) + gauss(r) * 2.5);
    const rot = (r() < 0.5 ? 0.12 : -0.12) + gauss(r) * 0.35;
    const erx = 5 + r() * 8;
    const ery = 2.2 + r() * 2.4;
    const dir = r() < 0.5 ? -1 : 1;
    P.soft(ex + Math.cos(rot) * erx * 0.9 * dir, yy + Math.sin(rot) * erx * 0.9 * dir, erx * 0.9, ery * 0.55, rot, SMUDGE, 0.12);
    P.soft(ex, yy, erx, ery, rot, LIFT, 0.55 + r() * 0.25);
    for (let j = 0; j < Math.floor(r() * 3); j++) crumbs.push([ex + gauss(r) * 4, yy + 3 + r() * 2, 0.22 + r() * 0.3]);
  }
  P.dots(crumbs, CRUMB, 0.2);
}

export interface PaintOptions {
  /** What makes this drawing this drink's: usually its id. */
  seed: string;
  style?: SketchStyleKey;
  /** 'thumb' for small tiles: no searching lines or hatching, fewer layers and passes. */
  detail?: 'full' | 'thumb';
}

export function paintSketch(inputs: SketchInputs, { seed, style = DEFAULT_SKETCH_STYLE, detail = 'full' }: PaintOptions): Scene {
  const S = detail === 'thumb'
    ? { ...SKETCH_STYLES[style], ghosts: 0, construct: 0, hatch: 0, cross: false, blooms: 0, passes: 2, layers: SKETCH_STYLES[style].layers * 0.6, splatter: 0 }
    : SKETCH_STYLES[style];
  // Three streams: where things go, the hand's wobble, and the searching
  // lines a thumbnail leaves out. Detail changes only the last two, so a drink
  // looks the same in a tile and on its page.
  const key = `${seed}|${style}`;
  const r = rng(hashString(key));
  const g = { ...glassShape(inputs.glass, inputs.variant) };
  const ice = inputs.ice;
  if (ice === 'crushed' || ice === 'shaved') g.top = g.rim + 3;
  if (ice === 'pebble') g.top = g.rim + 5;
  // A hot drink in the copper mug's place is a home mug; the glass mugs stay glass.
  if (inputs.glass === 'mug' && g.opaque && ice !== 'cubes') g.opaque = SKETCH.homeMug;

  const b = new SceneBuilder(`k${hashString(seed).toString(36)}`);
  const P = makePainter(S, r, rng(hashString(`${key}|hand`)), b, g);
  const { e, Rr, bot, ground } = P;
  const parts = glassParts(P);
  if (S.ghosts) searching(P, parts, rng(hashString(`${key}|search`)));
  if (S.construct) {
    P.line([[50, g.rim - 9], [50, ground + 7]], { passes: 1, alpha: S.construct, weight: 0.5, gaps: 0, over: 0 });
    P.line([[50 - Rr - 14, g.rim], [50 + Rr + 12, g.rim]], { passes: 1, alpha: S.construct * 1.2, weight: 0.5, gaps: 0, over: 0 });
    P.line([[50 - Rr - 6, ground + 0.5], [50 + Rr + 18, ground + 0.5]], { passes: 1, alpha: S.construct, weight: 0.5, gaps: 0, over: 0 });
  }

  // --- the drink ---
  const clear = inputs.liquid.alpha < 0.2;
  let tone = clear ? mixHex(inputs.liquid.hex, SKETCH.glassGrey, 0.55) : inputs.liquid.hex;
  if (S.mute) tone = mixHex(tone, SKETCH.mute, S.mute);
  const strength = clear ? 0.55 : Math.min(1.15, 0.55 + inputs.liquid.alpha * 0.6);
  const floor = g.stemmed ? bot : g.base!;
  if (g.opaque) {
    P.wash(P.silhouette, g.opaque, 0.75, { spill: 0.4, fadeTo: 0.55 });
    P.wash(band(g, g.top, g.top + 3.2), tone, strength, { layers: 0.6, spill: 0.2, n: 12, blooms: 0 });
  } else {
    P.wash(band(g, g.top, floor), tone, strength);
    P.wash(band(g, g.top + (floor - g.top) * 0.45, floor), mixHex(tone, SKETCH.pool, 0.15), strength * 0.3, { layers: 0.5, spill: 0.5, n: 12, fadeAngle: -Math.PI / 2, fadeTo: 0, blooms: 0.3, v1: 0.2 });
  }
  if (inputs.float) P.wash(band(g, g.top, g.top + 3.2), inputs.float, 0.9, { layers: 0.5, spill: 0.3, n: 12 });

  // --- foam ---
  const foam = ice === 'crushed' || ice === 'pebble' || ice === 'shaved' ? null : inputs.foam;
  let surface = g.top;
  if (foam) {
    const F = FOAM[foam];
    const y0 = g.top - F.rise;
    const y1 = g.top + F.depth;
    surface = y0;
    const col = foam === 'cap' ? SKETCH.capFoam : foam === 'crema' ? SKETCH.crema : foam === 'froth' ? mixHex(tone, SKETCH.froth, 0.72) : mixHex(tone, SKETCH.white, foam === 'silk' ? 0.6 : 0.62);
    P.glaze(band(g, y0, y1, 0.4), col, foam === 'sheen' ? 0.8 : 0.97, 3, 0.05);
    if (foam === 'crema') {
      for (let i = 0; i < 5; i++) {
        const yy = y0 + 1 + r() * (y1 - y0 - 2);
        const xx = 50 + (r() * 2 - 1) * (hw(g, yy) - 3) * 0.6;
        P.wash(ell(xx, yy, 3 + r() * 5, 0.9 + r() * 0.8, 0, Math.PI * 2, 10, gauss(r) * 0.15).slice(0, 10), SKETCH.cremaStreak, 0.5, { layers: 0.25, spill: 0.1, n: 10, blooms: 0, misreg: 0.1, fadeTo: 0.4 });
      }
    }
    if (foam !== 'sheen') P.wash(band(g, g.top + F.depth * 0.45, y1, 0.4), foam === 'crema' ? SKETCH.cremaShadow : mixHex(col, SKETCH.foamShadow, 0.5), foam === 'crema' ? 0.7 : 0.35, { layers: 0.45, spill: 0.15, n: 12, blooms: 0, fadeAngle: -Math.PI / 2, fadeTo: 0.2, misreg: 0.2 });
    const n = P.clipInner();
    for (let i = 0; i < F.bubbles; i++) {
      const y = y0 + Math.pow(r(), 1.6) * (y1 - y0);
      const rad = 0.22 + r() * (foam === 'cap' ? 0.55 : 0.4);
      P.line(ell(50 + (r() * 2 - 1) * (hw(g, y) - 1.5), y, rad, rad * 0.8, r(), r() + 5.8, 6), { weight: 0.42, alpha: 0.85, passes: 1, over: 0, gaps: 0.15, wob: 0.15 });
    }
    P.end(n);
    const Ry = hw(g, y1) - 0.4;
    P.line(ell(50, y1, Ry, Ry * e, 0.15, Math.PI - 0.15, 24), { weight: 0.5, alpha: foam === 'sheen' ? 0.35 : 0.6, passes: 1, gaps: 0.7, wob: 1.4 });
  }

  // --- ice, bubbles, drizzle ---
  const Rt0 = hw(g, g.top);
  P.line(ell(50, g.top, Rt0, Rt0 * e, Math.PI + 0.3, Math.PI * 2 - 0.4, 24), { weight: 0.5, alpha: 0.5, gaps: 1.5 });
  const iced = paintIce(P, ice, inputs.glass);
  if (inputs.fizz && !g.opaque) {
    const n = P.clipInner();
    for (let t = 0; t < 4; t++) {
      const x = 50 + (r() * 2 - 1) * (hw(g, g.top) - 5);
      let y = floor - 4 - r() * 14;
      for (let j = 0; j < 3 + Math.floor(r() * 3) && y > g.top + 3; j++) {
        const rad = 0.5 + r() * 0.7;
        P.line(ell(x + gauss(r) * 0.8, y, rad, rad * (0.8 + r() * 0.3), r(), r() + 5.6, 7), { weight: 0.35, alpha: 0.5, passes: 1, over: 0, gaps: 0.3, wob: 0.25 });
        y -= 3 + r() * 8;
      }
    }
    P.end(n);
  }
  if (inputs.bleed && !g.opaque) {
    const Rm = Rr * 0.96;
    const mound = g.rim - iced.crown;
    const cap: Pt[] = [];
    for (let t = 0; t <= 1.0001; t += 0.08) {
      const u = 2 * t - 1;
      cap.push([50 + u * Rm * 0.5, g.rim - mound * 0.55 * Math.sqrt(Math.max(0, 1 - u * u))]);
    }
    const R2: Pt[] = [];
    const L2: Pt[] = [];
    for (let y = g.rim; y <= floor; y += 1.5) {
      R2.push([50 + hw(g, y) - 1, y]);
      L2.push([50 - hw(g, y) + 1, y]);
    }
    P.wash([...cap, ...R2, ...L2.reverse()], inputs.bleed, 1.1, { fadeAngle: Math.PI / 2, fadeTo: 0.04, layers: 0.8, spill: 0.25, misreg: 0.4 });
  }
  if (iced.lateIn.length) {
    const n = P.clipInner();
    for (const [p, o] of iced.lateIn) P.line(p, o);
    P.end(n);
  }
  for (const [p, o] of iced.late) P.line(p, o);

  // --- garnish colour, shadow, then the pencil on top ---
  const garnishLines = paintGarnish(P, inputs.garnish, iced.crown, surface);
  {
    P.soft(50 + Rr * 0.25, ground + 1.4, Rr * 1.25, 4 * (1 + S.shadow) / P.k, 0, S.ink, 0.1 * S.shadow);
    const n = Math.round(6 + 10 * S.shadow);
    for (let i = 0; i < n; i++) {
      const y = ground + 0.6 + r() * 2.4;
      P.line([[50 - Rr * (0.6 + r() * 0.5), y], [50 + Rr * (0.9 + r() * 0.9), y + gauss(r) * 0.3]], { passes: 1, alpha: 0.35 * S.shadow, weight: 0.45, wob: 0.4, gaps: 0.3, over: 4 });
    }
  }
  for (const [p, o] of parts) P.line(p, o);
  if (g.handle) {
    const hx0 = 50 + hw(g, g.rim + 10);
    P.line([[hx0, g.rim + 10], [hx0 + 8, g.rim + 12], [hx0 + 9, g.rim + 26], [hx0 + 1, g.rim + 32]], { weight: 1, wob: 1.2 });
    P.line([[hx0, g.rim + 15], [hx0 + 4.5, g.rim + 16], [hx0 + 5, g.rim + 25], [hx0 + 0.5, g.rim + 28]], { weight: 0.6, alpha: 0.7 });
  }
  if (g.face) {
    const fy = g.rim + 20;
    for (const sx of [-1, 1]) P.line(ell(50 + sx * 6, fy, 3.2, 2, Math.PI * 0.1, Math.PI * 0.95, 10), { weight: 0.7 });
    P.line([[48, fy + 5], [50, fy + 9], [52, fy + 5]], { weight: 0.6 });
    P.line([[42, fy + 15], [58, fy + 15]], { weight: 0.7 });
    for (let x = 44; x <= 56; x += 3) P.line([[x, fy + 13], [x, fy + 17]], { weight: 0.45, alpha: 0.7 });
  }
  if (g.frost) {
    P.dots(Array.from({ length: 70 }, () => { const y = g.rim + 3 + r() * (bot - g.rim - 6); return [50 + (r() * 2 - 1) * (hw(g, y) - 1), y, 0.25 + r() * 0.5] as [number, number, number]; }), SKETCH.white, 0.35);
    const yy = g.rim + 4;
    P.line(ell(50, yy, hw(g, yy), hw(g, yy) * e, 0.1, Math.PI - 0.1, 24), { weight: 0.45, alpha: 0.6 });
  }
  if (ice !== 'crushed' && ice !== 'pebble' && ice !== 'shaved') {
    const Rf = hw(g, surface);
    P.line(ell(50, surface, Rf, Rf * e, 0.1, Math.PI - 0.1, 30), { weight: foam ? 0.85 : 0.7, alpha: ice !== 'none' ? 0.4 : 0.9, wob: foam ? 2.4 : 1 });
  }
  if (S.hatch) {
    P.hatch(P.silhouette, 50 + Rr * 0.25, -1.05, S.hatch);
    if (S.cross) P.hatch(P.silhouette, 50 + Rr * 0.45, -0.35, S.hatch * 0.7);
  }
  if (!g.stemmed) P.hatch(band(g, g.base! + 1, bot - 0.5), 50 - Rr, -0.25, 0.9 + S.hatch * 0.6);
  if (!g.opaque) P.line([[50 - Rr * 0.62, g.rim + 3], [50 - hw(g, g.rim + 3 + (bot - g.rim) * 0.35) * 0.7, g.rim + (bot - g.rim) * 0.42]], { passes: 1, weight: 0.4, alpha: 0.45, gaps: 0.5 });
  for (const p of garnishLines) P.line(p, { weight: 0.7, alpha: 0.9, over: 3, passes: Math.max(1, S.passes - 1) });
  if (S.splatter) {
    P.dots(Array.from({ length: S.splatter }, () => {
      const a = r() * Math.PI * 2;
      const dist = Rr * (1 + r() * 0.9);
      return [50 + Math.cos(a) * dist, (g.top + bot) / 2 + Math.sin(a) * dist * 0.9, (0.8 + r() * r() * 5) / P.k] as [number, number, number];
    }), tone, 0.5);
  }
  return b.done();
}
