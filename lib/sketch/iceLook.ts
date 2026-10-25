// What a venue knows about its ice, drawn on a piece (Kit and ice, step 10):
// a cloudy core, a clear piece's glint, a stamp on the top face, something
// frozen inside. Sizes come in through ice.ts; these only mark the piece.

import { SKETCH } from '../../constants/sketch';
import { ell, hull, type IceBox, type Pt } from './geometry';
import type { Painter } from './painter';
import { SKETCH_PAPER } from './styles';
import type { IceLook } from './types';

/** How a block's lines read: clear pieces fade under the drink, and the joins between stacked clear pieces nearly vanish. */
export interface BoxLook extends IceLook {
  /** The drink's surface, for what's under it. */
  surface: number;
  /** Faces another piece rests on or sits under, whose edges are joins. */
  seam?: 'top' | 'bottom' | 'both';
}

const centre = (pts: Pt[]): Pt => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
const lerp = (a: Pt, c: Pt, t: number): Pt => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];

/** Vertex ids on a block's top (y -1) or bottom (y +1) face (geometry.ts box ids its corners x*4 + y*2 + z). */
export const onFace = (i: number, face: 'top' | 'bottom') => ((i >> 1) & 1) === (face === 'top' ? 0 : 1);

/**
 * A block edge in pieces, each with how strongly it shows: full above the
 * drink; under it, a clear piece's edge fades, and a join between stacked
 * clear pieces is all but gone.
 */
export function edgeParts(A: Pt, C: Pt, look: BoxLook, seam: boolean): [Pt, Pt, number][] {
  if (look.clear !== true) return [[A, C, 1]];
  const under = seam ? 0.15 : 0.75;
  const s = look.surface;
  const [a, c] = [A[1] >= s, C[1] >= s];
  if (a === c) return [[A, C, a ? under : 1]];
  const M = lerp(A, C, (s - A[1]) / (C[1] - A[1]));
  return [[A, M, a ? under : 1], [M, C, c ? under : 1]];
}

/** Lifts the paint under a piece: clear ice lets the drink through, cloudy ice has a white core. */
export function liftLook(P: Painter, V: Pt[], look: IceLook) {
  const H = hull(V);
  const clear = look.clear === true;
  P.glaze(H, SKETCH_PAPER, clear ? 0.18 : 0.26, 3, 0.14);
  const above = P.clipAbove(P.g.top + 0.3);
  P.glaze(H, SKETCH_PAPER, clear ? 0.35 : 0.45, 3, 0.14);
  P.end(above);
  if (look.clear === false) core(P, H, 0.55);
}

/** A cloudy piece's white heart: trapped air frozen last, in the middle. */
function core(P: Painter, outline: Pt[], k: number) {
  const c = centre(outline);
  const inner = outline.map((p) => lerp(c, p, k));
  P.glaze(inner, SKETCH.white, 0.5, 3, 0.2);
  P.glaze(inner.map((p) => lerp(c, p, 0.55)), SKETCH.white, 0.3, 2, 0.15);
}

/** A clear piece's glint: one short stroke down its lit side. */
function glint(P: Painter, V: Pt[]) {
  const x0 = Math.min(...V.map((v) => v[0]));
  const y0 = Math.min(...V.map((v) => v[1]));
  const y1 = Math.max(...V.map((v) => v[1]));
  const h = y1 - y0;
  P.line([[x0 + Math.max(1, h * 0.07), y0 + h * 0.3], [x0 + Math.max(1, h * 0.07), y0 + h * 0.3 + Math.min(10, h * 0.25)]], { weight: 0.4, alpha: 0.55, passes: 1, over: 0, gaps: 0, wob: 0.3 });
}

/** A ring pressed into a face: two rings, the inner fainter. */
function stampRing(P: Painter, c: Pt, u: Pt, v: Pt) {
  const ring = (k: number) => Array.from({ length: 19 }, (_, i) => {
    const t = (i / 18) * Math.PI * 2;
    return [c[0] + (u[0] * Math.cos(t) + v[0] * Math.sin(t)) * k, c[1] + (u[1] * Math.cos(t) + v[1] * Math.sin(t)) * k] as Pt;
  });
  P.glaze(ring(0.55), SKETCH_PAPER, 0.6, 2, 0.05);
  P.line(ring(0.55), { weight: 0.7, alpha: 1, passes: 2, over: 0.6, gaps: 0, wob: 0.4 });
  P.line(ring(0.3), { weight: 0.5, alpha: 0.8, passes: 1, over: 0.3, gaps: 0, wob: 0.3 });
}

/** Something frozen in the middle, drawn as a small prism: a coloured face and its pencil edges. */
function prism(P: Painter, c: Pt, size: number) {
  const s = size;
  const front: Pt[] = [[c[0] - s * 0.5, c[1] + s * 0.32], [c[0] + s * 0.4, c[1] + s * 0.36], [c[0] - s * 0.05, c[1] - s * 0.5]];
  const off: Pt = [s * 0.32, -s * 0.16];
  const back = front.map(([x, y]) => [x + off[0], y + off[1]] as Pt);
  P.glaze([front[0], front[1], back[1], back[2], front[2]], SKETCH.orangeWheel, 0.35, 2, 0.04);
  P.glaze(front, SKETCH.orangeWheel, 0.6, 2, 0.04);
  const o = { weight: 0.45, alpha: 0.8, passes: 1, over: 0.4, gaps: 0, wob: 0.3 };
  P.line([...front, front[0]], o);
  P.line([front[1], back[1], back[2], front[2]], o);
}

/** A block's marks: glint, stamp on its top face, what's frozen inside. */
export function markBox(P: Painter, b: IceBox, look: IceLook) {
  const V = b.V;
  if (look.clear === true) glint(P, V);
  const top = b.faces.find((f) => f.top && f.vis);
  if (look.stamp && top) {
    const [p0, p1, , p3] = top.q.map((i) => V[i]);
    const c = centre(top.q.map((i) => V[i]));
    stampRing(P, c, [(p1[0] - p0[0]) / 2, (p1[1] - p0[1]) / 2], [(p3[0] - p0[0]) / 2, (p3[1] - p0[1]) / 2]);
  }
  if (look.inside) {
    const xs = V.map((v) => v[0]);
    const ys = V.map((v) => v[1]);
    const span = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    // Below the top face, in the body of the piece.
    const c = centre(V);
    prism(P, [c[0], c[1] + span * 0.06], Math.max(3, span * 0.34));
  }
}

/** A sphere's marks: its white core or glint, a stamp on top, what's frozen inside. */
export function markSphere(P: Painter, cx: number, cy: number, rad: number, look: IceLook) {
  if (look.clear === false) core(P, ell(cx, cy, rad, rad, 0, Math.PI * 2, 18), 0.55);
  if (look.clear === true) glint(P, [[cx - rad * 0.86, cy - rad * 0.5], [cx - rad * 0.86, cy + rad * 0.5]]);
  if (look.stamp) stampRing(P, [cx, cy - rad * 0.68], [rad * 0.62, 0], [0, rad * 0.2]);
  if (look.inside) prism(P, [cx, cy + rad * 0.05], Math.max(3, rad * 0.65));
}
