// Ice, drawn like the house sketches: wobbly, uneven outlines and a little
// paint lifted out, never a rendered block.

import { box, ell, hull, hw, restOn, type IceBox, type Pt } from './geometry';
import type { LineOpts, Painter } from './painter';
import { gauss } from './random';
import { SKETCH_PAPER } from './styles';
import type { SketchGlass, SketchIce } from './types';

export interface IceResult {
  /** The highest point of the drink or its ice, for garnish to sit on. */
  crown: number;
  /** Lines drawn after the washes: over everything, and clipped inside the glass. */
  late: [Pt[], LineOpts][];
  lateIn: [Pt[], LineOpts][];
}

const TALL: SketchGlass[] = ['highball', 'collins', 'fizz', 'beer'];

function roughEdge(P: Painter, A: Pt, C: Pt, amt = 0.07): Pt[] {
  const { r } = P;
  const len = Math.hypot(C[0] - A[0], C[1] - A[1]) || 1;
  const nx = -(C[1] - A[1]) / len;
  const ny = (C[0] - A[0]) / len;
  const b1 = gauss(r) * len * amt;
  const b2 = gauss(r) * len * amt;
  return [A, [A[0] + (C[0] - A[0]) / 3 + nx * b1, A[1] + (C[1] - A[1]) / 3 + ny * b1], [A[0] + ((C[0] - A[0]) * 2) / 3 + nx * b2, A[1] + ((C[1] - A[1]) * 2) / 3 + ny * b2], C];
}

/** Nudges a block's corners off true, so its edges never come out ruler-straight. */
function jitter(P: Painter, b0: IceBox): IceBox {
  return { ...b0, V: b0.V.map(([x, y]) => [x + gauss(P.r) * 0.8, y + gauss(P.r) * 0.8] as Pt) };
}

/** Lifts a little paint where the block sits: soft and blotchy, more above the drink. */
function liftBox(P: Painter, b0: IceBox) {
  const H = hull(b0.V);
  P.glaze(H, SKETCH_PAPER, 0.26, 3, 0.14);
  const above = P.clipAbove(P.g.top + 0.3);
  P.glaze(H, SKETCH_PAPER, 0.45, 3, 0.14);
  P.end(above);
}

/** The block's wobbly outline and a few loose shading strokes. */
function drawBox(P: Painter, b0: IceBox, kind: 'large' | 'cubes' | 'spear') {
  const { r, S } = P;
  const V = b0.V;
  const edges = new Map<string, number>();
  for (const fc of b0.faces) {
    if (!fc.vis) continue;
    for (let i = 0; i < 4; i++) {
      const a = fc.q[i];
      const c = fc.q[(i + 1) % 4];
      const key = a < c ? `${a}-${c}` : `${c}-${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  for (const [key, n] of edges) {
    const [a, c] = key.split('-').map(Number);
    if (n === 2 && r() < 0.3) continue;
    P.line(roughEdge(P, V[a], V[c], kind === 'spear' ? 0.03 : 0.07), { weight: n === 1 ? 0.75 : 0.5, alpha: n === 1 ? 0.85 : 0.6, passes: n === 1 ? S.passes : 1, wob: 1.8, over: 3.5, gaps: 0.7 });
  }
  // a few loose shading strokes on the side away from the light
  const side = b0.faces.filter((x) => x.vis && !x.top).sort((x, y) => y.n[0] - x.n[0])[0];
  if (side) {
    const p = side.q.map((i) => V[i]);
    const n = kind === 'spear' ? 7 : 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const t = 0.2 + r() * 0.6;
      const u = 0.15 + r() * 0.5;
      const A: Pt = [p[0][0] + (p[1][0] - p[0][0]) * t, p[0][1] + (p[1][1] - p[0][1]) * t];
      const C: Pt = [p[3][0] + (p[2][0] - p[3][0]) * t, p[3][1] + (p[2][1] - p[3][1]) * t];
      const u2 = u + 0.2 + r() * 0.25;
      P.line([[A[0] + (C[0] - A[0]) * u, A[1] + (C[1] - A[1]) * u], [A[0] + (C[0] - A[0]) * u2, A[1] + (C[1] - A[1]) * u2]], { weight: 0.35, alpha: 0.4, passes: 1, over: 1, gaps: 0, wob: 0.6 });
    }
  }
  if (kind === 'large' && r() < 0.8) {
    const fr = b0.faces.filter((x) => x.vis && !x.top)[0];
    if (fr) {
      const p = fr.q.map((i) => V[i]);
      const ta = 0.2 + r() * 0.3;
      const tb = 0.5 + r() * 0.4;
      const A: Pt = [p[0][0] + (p[1][0] - p[0][0]) * ta, p[0][1] + (p[1][1] - p[0][1]) * ta];
      const B: Pt = [p[3][0] + (p[2][0] - p[3][0]) * tb, p[3][1] + (p[2][1] - p[3][1]) * tb];
      P.line(roughEdge(P, A, B, 0.12), { weight: 0.3, alpha: 0.35, passes: 1, over: 0, wob: 1.2 });
    }
  }
}

function chunk(P: Painter, cx: number, cy: number, rad: number, round: boolean): Pt[] {
  const { r } = P;
  if (round) return ell(cx, cy, rad, rad * (0.7 + r() * 0.3), 0, Math.PI * 2, 9, r() * 3).slice(0, 9).map(([x, y]) => [x + gauss(r) * 0.15, y + gauss(r) * 0.15] as Pt);
  const n = 4 + Math.floor(r() * 3);
  const a = Array.from({ length: n }, () => r() * Math.PI * 2).sort((x, y) => x - y);
  return a.map((t) => {
    const rr = rad * (0.6 + r() * 0.5);
    return [cx + Math.cos(t) * rr, cy + Math.sin(t) * rr * 0.85] as Pt;
  });
}

export function paintIce(P: Painter, ice: SketchIce, glass: SketchGlass): IceResult {
  const { r, g, e, Rr } = P;
  const late: IceResult['late'] = [];
  const lateIn: IceResult['lateIn'] = [];
  let crown = g.top;
  const base = g.base ?? P.bot;

  if (ice === 'large') {
    const n = P.clipInner();
    const s = 24 + gauss(r);
    const block = jitter(P, restOn(box(50 + gauss(r), 0, s, s * 0.96, s, 0.5 + gauss(r) * 0.15, gauss(r) * 0.05, 0.3), base - 0.4));
    liftBox(P, block);
    drawBox(P, block, 'large');
    P.end(n);
  } else if (ice === 'cubes') {
    const n = P.clipInner();
    const list: IceBox[] = [];
    if (TALL.includes(glass)) {
      const s = 14.5;
      let row = 0;
      for (let y = base - 0.4; y > g.top - s * 0.3; y -= s * 0.78, row++) {
        const xs = row % 2 ? [50 + gauss(r) * 1.2, 35.5 + gauss(r) * 0.6, 64.5 + gauss(r) * 0.6] : [42.8 + gauss(r), 57.2 + gauss(r)];
        for (const x of xs) list.push(restOn(box(x, 0, s, s * 0.95, s, r() * 1.5, gauss(r) * 0.12, 0.32), y + gauss(r) * 0.6));
      }
    } else {
      const s = 13.2;
      const spots: Pt[] = [[41.5, base - 0.3], [58.5, base - 0.6], [49.5, base - 10.5], [60, base - 17.5], [39.5, base - 18]];
      for (const [x, y] of spots) list.push(restOn(box(x + gauss(r), 0, s, s * 0.95, s, r() * 1.5, gauss(r) * 0.15, 0.32), y + gauss(r) * 0.5));
    }
    list.sort((a, b) => Math.min(...a.V.map((v) => v[1])) - Math.min(...b.V.map((v) => v[1])));
    const blocks = list.map((bx) => jitter(P, bx));
    for (const bx of blocks) liftBox(P, bx);
    for (const bx of blocks) drawBox(P, bx, 'cubes');
    P.end(n);
  } else if (ice === 'spear') {
    const n = P.clipInner();
    const top = g.top - 6.5;
    const spear = jitter(P, restOn(box(50 + gauss(r) * 0.8, 0, 13, base - top, 10.5, 0.55 + gauss(r) * 0.1, gauss(r) * 0.025, 0.3), base - 0.4));
    liftBox(P, spear);
    drawBox(P, spear, 'spear');
    P.end(n);
  } else if (ice === 'sphere') {
    const n = P.clipInner();
    const rad = Math.min(12, hw(g, base) - 3);
    const cy = base - rad - 0.3;
    const cx = 50 + gauss(r) * 0.8;
    const ball = ell(cx, cy, rad, rad, 0, Math.PI * 2, 28);
    P.glaze(ball, SKETCH_PAPER, 0.28, 3, 0.06);
    const above = P.clipAbove(g.top + 0.3);
    P.glaze(ball, SKETCH_PAPER, 0.45, 3, 0.06);
    P.end(above);
    P.line(ball.map(([x, y]) => [x + gauss(r) * 0.25, y + gauss(r) * 0.25] as Pt), { weight: 0.75, alpha: 0.85, wob: 1.4, over: 3, gaps: 0.4 });
    P.line(ell(cx - rad * 0.25, cy - rad * 0.3, rad * 0.55, rad * 0.45, Math.PI * 1.05, Math.PI * 1.6, 10), { weight: 0.35, alpha: 0.45, passes: 1, over: 0 });
    P.end(n);
  } else if (ice === 'crushed' || ice === 'pebble' || ice === 'shaved') {
    const round = ice === 'pebble';
    const fine = ice === 'shaved';
    const moundH = round ? 5.5 : fine ? 13 : 10;
    crown = g.rim - moundH;
    const n = P.clipInner();
    for (let i = 0; i < 5; i++) {
      const y = g.top + 2 + r() * (base - g.top - 4);
      const w = hw(g, y) - 5;
      const rad = 4 + r() * 4;
      P.glaze(ell(50 + (r() * 2 - 1) * w, y, rad, rad * 0.7, 0, Math.PI * 2, 7, r() * 3).slice(0, 7), SKETCH_PAPER, 0.16, 3, 0.2);
    }
    for (let i = 0; i < (round ? 58 : 64); i++) {
      const y = g.top + 1 + Math.pow(r(), 1.3) * (base - g.top - 2);
      const w = hw(g, y) - 2;
      const c = chunk(P, 50 + (r() * 2 - 1) * w, y, 1.5 + r() * (round ? 1.6 : 1.5), round);
      if (r() < 0.7) {
        const st = Math.floor(r() * c.length);
        const m = round ? 3 + Math.floor(r() * 3) : 2 + Math.floor(r() * 2);
        lateIn.push([c.slice(st).concat(c.slice(0, st)).slice(0, m), { weight: 0.42, alpha: 0.7, passes: 1, over: 1.2, gaps: 0.35, wob: 1 }]);
      }
    }
    P.end(n);
    // the mound above the rim
    const Rm = Rr * 0.96;
    const top: Pt[] = [];
    for (let t = 0; t <= 1.0001; t += 0.04) {
      const u = 2 * t - 1;
      top.push([50 + u * Rm, g.rim - moundH * Math.sqrt(Math.max(0, 1 - u * u)) - r() * 1.2]);
    }
    const dome = [...top, ...ell(50, g.rim, Rm, Rm * e, 0, Math.PI, 16).reverse()].reverse();
    P.glaze(dome, SKETCH_PAPER, 0.8, 3, 0.1);
    for (let i = 0; i < (round ? 26 : fine ? 70 : 44); i++) {
      const u = r() * 2 - 1;
      const yMax = g.rim + Rm * e * Math.sqrt(1 - u * u) * 0.8;
      const yMin = g.rim - moundH * Math.sqrt(Math.max(0, 1 - u * u)) + 1;
      const rad0 = (round ? 1.8 : 1.3) + r() * (round ? 1.2 : 1.4);
      const c = chunk(P, 50 + u * (Rm - 2), yMin + r() * (yMax - yMin), fine ? rad0 * 0.6 : rad0, round);
      const st = Math.floor(r() * c.length);
      if (r() < 0.8) late.push([c.slice(st).concat(c.slice(0, st)).slice(0, round ? 5 : 3), { weight: 0.45, alpha: 0.8, passes: 1, over: 1.2, gaps: 0.35, wob: 1 }]);
    }
    late.push([top, { weight: 0.75, alpha: 0.9, wob: 2, gaps: 0.4 }]);
  }
  return { crown, late, lateIn };
}
