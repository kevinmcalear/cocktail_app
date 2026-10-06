// The painter's hand: wobbly pencil lines, layered watercolour washes,
// hatching, glazes and soft smudges, all in glass units (0 to 100) and
// written to a SceneBuilder in scene units.

import { SKETCH } from '@/constants/sketch';
import { bottomOf, band, ecc, ell, hw, resample, resampleN, type GlassShape, type Pt, type PtV } from './geometry';
import { gauss, mixHex, noise1, type Rng } from './random';
import { SCENE_SIZE, SceneBuilder } from './scene';
import { SKETCH_PAPER, type SketchStyle } from './styles';

export interface LineOpts {
  passes?: number;
  weight?: number;
  alpha?: number;
  wob?: number;
  over?: number;
  gaps?: number;
  noOver?: boolean;
}

export interface WashOpts {
  spill?: number;
  misreg?: number;
  n?: number;
  v1?: number;
  v2?: number;
  layers?: number;
  blooms?: number;
  fadeAngle?: number;
  fadeTo?: number;
}

export interface Painter {
  S: SketchStyle;
  r: Rng;
  b: SceneBuilder;
  g: GlassShape;
  /** Scene units per glass unit. */
  k: number;
  U: (p: Pt) => Pt;
  e: number;
  Rr: number;
  bot: number;
  ground: number;
  silhouette: Pt[];
  inner: Pt[];
  line: (pts: Pt[], o?: LineOpts) => void;
  wash: (poly: Pt[], color: string, strength: number, o?: WashOpts) => void;
  glaze: (poly: Pt[], color: string, alpha: number, layers?: number, v?: number) => void;
  soft: (cx: number, cy: number, rx: number, ry: number, rot: number, color: string, alpha: number) => void;
  hatch: (region: Pt[], minX: number, angle: number, weight: number) => void;
  dots: (list: [number, number, number][], color: string, o: number) => void;
  /** Clip what follows to inside the glass (and, for a vessel you can't see into, to above the drink). Returns how many clips to end. */
  clipInner: () => number;
  /** Clip what follows to above a height. */
  clipAbove: (y: number) => number;
  /** Ends that many clips. */
  end: (n: number) => void;
}

function deform(poly: PtV[], depth: number, variance: number, r: Rng): PtV[] {
  let p = poly;
  for (let d = 0; d < depth; d++) {
    const out: PtV[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const v = (a[2] + b[2]) / 2;
      out.push(a);
      out.push([(a[0] + b[0]) / 2 + gauss(r) * len * variance * v, (a[1] + b[1]) / 2 + gauss(r) * len * variance * v, v * (0.85 + r() * 0.3)]);
    }
    p = out;
  }
  return p;
}
const xy = (p: PtV[]): Pt[] => p.map(([x, y]) => [x, y]);

export function makePainter(S: SketchStyle, r: Rng, b: SceneBuilder, g: GlassShape): Painter {
  const W = SCENE_SIZE;
  const k = (W / 100) * 1.06;
  const U = ([u, v]: Pt): Pt => [(u - 50) * k + W / 2, (v - 51) * k + W / 2];
  const e = ecc(g);
  const Rr = hw(g, g.rim);
  const bot = bottomOf(g);
  const ground = g.stemmed ? g.foot![0] : bot;
  const silhouette = band(g, g.rim, bot);
  const inner = band(g, g.rim + 1.5, g.stemmed ? bot : g.base!, 1.1);

  const line = (ptsU: Pt[], o: LineOpts = {}) => {
    const px = resample(ptsU.map(U), 3.5);
    if (px.length < 2) return;
    const passes = o.passes ?? S.passes;
    for (let p = 0; p < passes; p++) {
      const n1 = noise1(r);
      const n2 = noise1(r);
      const amp = S.wobble * (o.wob ?? 1);
      const fr = 0.018 + r() * 0.03;
      const dx = gauss(r) * S.drift;
      const dy = gauss(r) * S.drift;
      let L = 0;
      const out: Pt[] = px.map((q, i) => {
        if (i) L += Math.hypot(q[0] - px[i - 1][0], q[1] - px[i - 1][1]);
        const t = L * fr;
        return [q[0] + dx + n1(t) * amp, q[1] + dy + n2(t) * amp];
      });
      if (!o.noOver) {
        const ov = (o.over ?? S.over) * r();
        const [a0, a1] = [out[0], out[1]];
        const m = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) || 1;
        out.unshift([a0[0] - ((a1[0] - a0[0]) / m) * ov, a0[1] - ((a1[1] - a0[1]) / m) * ov]);
        const ov2 = (o.over ?? S.over) * r();
        const [c0, c1] = [out[out.length - 2], out[out.length - 1]];
        const m2 = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) || 1;
        out.push([c1[0] + ((c1[0] - c0[0]) / m2) * ov2, c1[1] + ((c1[1] - c0[1]) / m2) * ov2]);
      }
      let a = 0;
      let z = out.length;
      if (r() < S.gaps * (o.gaps ?? 1)) {
        const cut = Math.floor(out.length * (0.08 + r() * 0.32));
        if (r() < 0.5) a = cut;
        else z = out.length - cut;
      }
      if (S.smudge && (o.weight ?? 1) > 0.6) b.stroke(out.slice(a, z), S.ink, 0.05, S.width * 3.2);
      const dash = S.dashes.length ? S.dashes[Math.floor(r() * S.dashes.length)] : null;
      const chunk = Math.max(5, Math.floor((z - a) / (2 + Math.floor(r() * 4))));
      for (let s = a; s < z - 1; s += chunk) {
        const seg = out.slice(s, Math.min(z, s + chunk + 1));
        b.stroke(seg, S.ink, Math.min(1, S.alpha * (o.alpha ?? 1) * (0.4 + r() * 0.6)), S.width * (o.weight ?? 1) * (0.55 + r() * 0.9), dash);
      }
    }
  };

  const wash = (polyU: Pt[], color: string, strength: number, o: WashOpts = {}) => {
    const poly = polyU.map(U);
    let cx = 0;
    let cy = 0;
    for (const p of poly) {
      cx += p[0];
      cy += p[1];
    }
    cx /= poly.length;
    cy /= poly.length;
    const sc = 1 + S.spill * (o.spill ?? 1);
    const ox = gauss(r) * S.misreg * (o.misreg ?? 1);
    const oy = gauss(r) * S.misreg * 0.6 * (o.misreg ?? 1);
    // Detail follows size: a petal needs far fewer points than a whole drink.
    let perim = 0;
    for (let i = 0; i < poly.length; i++) perim += Math.hypot(poly[(i + 1) % poly.length][0] - poly[i][0], poly[(i + 1) % poly.length][1] - poly[i][1]);
    const small = perim < 260;
    let base: PtV[] = resampleN(poly, Math.max(6, Math.min(o.n ?? 12, Math.round(perim / 40)))).map(([x, y]) => [cx + (x - cx) * sc + ox, cy + (y - cy) * sc + oy, 0.6 + r() * 0.8]);
    base = deform(base, 2, o.v1 ?? 0.13, r);
    // Fewer, stronger layers than on canvas, with the same build-up overall.
    const full = Math.max(6, Math.round(S.layers * (o.layers ?? 1)));
    const L = Math.max(5, Math.round(full * 0.3));
    const a = Math.min(0.95, S.wash * strength);
    const per = 1 - Math.pow(1 - a, full / L);
    const ds: string[] = [];
    let cur = base;
    for (let i = 0; i < L; i++) {
      if (i > 0 && i % Math.ceil(L / 3) === 0) cur = deform(base, 1, 0.1, r);
      const p = xy(deform(cur, small ? 1 : 2, (o.v2 ?? 0.1) * 1.3, r));
      ds.push('M' + p.map((q) => `${Math.round(q[0])} ${Math.round(q[1])}`).join('L') + 'Z');
    }
    let minX = 1e9;
    let maxX = -1e9;
    let minY = 1e9;
    let maxY = -1e9;
    for (const [x, y] of poly) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const ang = o.fadeAngle ?? r() * Math.PI * 2;
    const R = Math.max(maxX - minX, maxY - minY) * 0.7;
    b.wash({
      ds, color, o: per, edge: mixHex(color, SKETCH.washEdge, 0.25), edgeO: 1 - Math.pow(1 - a * 0.85, full / L) * 1, edgeW: 1.2,
      grad: [cx - Math.cos(ang) * R, cy - Math.sin(ang) * R, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R],
      fadeTo: o.fadeTo ?? S.fadeTo,
    });
    // back-runs: irregular lifted patches with a hard, slightly darker edge
    const nb = Math.round(S.blooms * (o.blooms ?? 1));
    for (let i = 0; i < nb; i++) {
      const v = poly[Math.floor(r() * poly.length)];
      const tt = 0.15 + r() * 0.5;
      const bx = cx + (v[0] - cx) * tt;
      const by = cy + (v[1] - cy) * tt;
      const br = (maxX - minX) * (0.05 + r() * 0.1);
      const bp = xy(deform(ell(bx, by, br, br * (0.6 + r() * 0.5), 0, Math.PI * 2, 9, r() * 3).slice(0, 9).map(([x, y]) => [x, y, 0.7 + r() * 0.6] as PtV), 3, 0.22, r));
      b.fill(bp, SKETCH_PAPER, 0.3);
      b.stroke([...bp, bp[0]], mixHex(color, SKETCH.washEdge, 0.3), 0.12 * strength, 1.6);
    }
  };

  const glaze = (polyU: Pt[], color: string, alpha: number, layers = 2, v = 0.035) => {
    const p: PtV[] = polyU.map(U).map(([x, y]) => [x, y, 1]);
    for (let i = 0; i < layers; i++) b.fill(xy(deform(p, 1, v, r)), color, Math.min(1, (alpha / layers) * 1.6));
  };

  const soft = (cx: number, cy: number, rx: number, ry: number, rot: number, color: string, alpha: number) => {
    const [px, py] = U([cx, cy]);
    b.soft(px, py, rx * k, ry * k, rot, color, alpha);
  };

  const hatch = (regionU: Pt[], minX: number, angle: number, weight: number) => {
    const reg = regionU.map(U);
    b.begin(reg);
    let x0 = 1e9;
    let x1 = -1e9;
    let y0 = 1e9;
    let y1 = -1e9;
    for (const [x, y] of reg) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    const mx = U([minX, 0])[0];
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const span = Math.hypot(x1 - x0, y1 - y0);
    for (let t = -span; t < span; t += (5.5 / weight) * (0.7 + r() * 0.6)) {
      const cx = (x0 + x1) / 2 - dy * t;
      const cy = (y0 + y1) / 2 + dx * t;
      const len = span * (0.25 + r() * 0.45);
      const a: Pt = [cx - (dx * len) / 2, cy - (dy * len) / 2];
      const z: Pt = [cx + (dx * len) / 2 + gauss(r), cy + (dy * len) / 2 + gauss(r)];
      if (Math.max(a[0], z[0]) < mx) continue;
      b.stroke([a, z], S.ink, S.alpha * 0.35 * weight * (0.5 + r() * 0.5), S.width * 0.55 * (0.6 + r() * 0.7));
    }
    b.end();
  };

  const dots = (list: [number, number, number][], color: string, o: number) =>
    b.dots(list.map(([u, v, rad]) => { const [x, y] = U([u, v]); return [x, y, rad * k] as [number, number, number]; }), color, o);

  const clipAbove = (y: number) => {
    const yy = U([0, y])[1];
    b.begin([[0, 0], [W, 0], [W, yy], [0, yy]]);
    return 1;
  };
  const clipInner = () => {
    b.begin(inner.map(U));
    return g.opaque ? 1 + clipAbove(g.top + 1.5) : 1;
  };
  const end = (n: number) => {
    for (let i = 0; i < n; i++) b.end();
  };

  return { S, r, b, g, k, U, e, Rr, bot, ground, silhouette, inner, line, wash, glaze, soft, hatch, dots, clipInner, clipAbove, end };
}
