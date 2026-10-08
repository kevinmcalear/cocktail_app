// A drawing as a short list of SVG-ready shapes, built like a canvas: the
// painter fills, strokes and clips, and this keeps the order while merging
// strokes of the same weight and tone into one path, so a drawing is a hundred
// or so elements rather than thousands.

import type { Pt } from './geometry';

export const SCENE_SIZE = 512;

export type SceneEl =
  | { k: 'fill'; d: string; color: string; o: number }
  | { k: 'stroke'; d: string; color: string; o: number; w: number; dash: string | null; band?: number }
  | {
      k: 'wash';
      id: string;
      ds: string[];
      color: string;
      /** Opacity of each layer; overlaps build up into soft centres and darker edges. */
      o: number;
      edge: string;
      edgeO: number;
      edgeW: number;
      /** The fade across the wash: gradient line in scene units, and the far end's strength. */
      grad: [number, number, number, number];
      fadeTo: number;
    }
  | { k: 'soft'; id: string; cx: number; cy: number; rx: number; ry: number; rot: number; color: string; o: number }
  | { k: 'group'; id: string; clip: string; children: SceneEl[] }
  | { k: 'stage'; name: StageName; ox: number; oy: number; children: SceneEl[] };

/**
 * The parts of a drawing, in the order a hand would make them. A still drawing
 * ignores them; an animated one (components/ds/AnimatedSketch) brings each in
 * on its own beat: the pencil finds the glass, the drink pours, the ice drops.
 */
/** How many bands the glass's pencil is drawn in, top to bottom. */
export const GLASS_BANDS = 10;

export type StageName = 'search' | 'liquid' | 'foam' | 'ice' | 'fizz' | 'garnish' | 'glass' | 'finish';

export interface Scene {
  size: number;
  els: SceneEl[];
}

const n1 = (v: number) => Math.round(v);
// Few tones and weights, so most strokes share a path.
const TONES = [0.08, 0.15, 0.25, 0.4, 0.6, 0.85];
const WEIGHTS = [0.35, 0.6, 0.9, 1.3, 1.9, 2.8, 4];
const nearest = (list: number[], v: number) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
export const pathOf = (pts: Pt[], close: boolean) =>
  pts.length ? 'M' + pts.map((p) => `${n1(p[0])} ${n1(p[1])}`).join('L') + (close ? 'Z' : '') : '';

interface Pending {
  color: string;
  o: number;
  w: number;
  dash: string | null;
  band?: number;
  parts: string[];
}

export class SceneBuilder {
  private readonly root: SceneEl[] = [];
  private readonly stack: SceneEl[][] = [this.root];
  private pending = new Map<string, Pending>();
  /** How deep end() may pop: past the open stage, never into it. */
  private floor = 1;
  /** Horizontal bands the open stage's strokes are kept in (0: none). */
  private bands = 0;
  private n = 0;

  constructor(private readonly prefix: string) {}

  private get cur() {
    return this.stack[this.stack.length - 1];
  }

  id(kind: string) {
    return `${this.prefix}${kind}${this.n++}`;
  }

  private flush() {
    for (const p of this.pending.values()) {
      this.cur.push({ k: 'stroke', d: p.parts.join(''), color: p.color, o: p.o, w: p.w, dash: p.dash, ...(p.band === undefined ? {} : { band: p.band }) });
    }
    this.pending.clear();
  }

  /** A stroke, merged with others of the same colour, weight, tone and dash until something else is drawn. */
  stroke(pts: Pt[], color: string, o: number, w: number, dash: string | null = null) {
    if (pts.length < 2 || o <= 0.004) return;
    const wq = nearest(WEIGHTS, w);
    const oq = nearest(TONES, o);
    // In a banded stage, by where the stroke starts: band 0 is the top.
    const band = this.bands ? Math.min(this.bands - 1, Math.max(0, Math.floor((pts[0][1] / SCENE_SIZE) * this.bands))) : undefined;
    const key = `${color}|${wq}|${oq}|${dash ?? ''}|${band ?? ''}`;
    let p = this.pending.get(key);
    if (!p) {
      p = { color, o: oq, w: wq, dash, band, parts: [] };
      this.pending.set(key, p);
    }
    p.parts.push(pathOf(pts, false));
  }

  fill(pts: Pt[], color: string, o: number) {
    if (pts.length < 3 || o <= 0.004) return;
    this.flush();
    this.cur.push({ k: 'fill', d: pathOf(pts, true), color, o: Math.min(1, o) });
  }

  /** Small round marks (crumbs, salt, spice, frost) as one path. */
  dots(list: [number, number, number][], color: string, o: number) {
    if (!list.length) return;
    this.flush();
    const d = list
      .map(([x, y, r]) => `M${n1(x - r)} ${n1(y)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(r * 2)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-r * 2)} 0`)
      .join('');
    this.cur.push({ k: 'fill', d, color, o });
  }

  wash(el: Omit<Extract<SceneEl, { k: 'wash' }>, 'k' | 'id'>) {
    this.flush();
    this.cur.push({ k: 'wash', id: this.id('w'), ...el });
  }

  soft(cx: number, cy: number, rx: number, ry: number, rot: number, color: string, o: number) {
    this.flush();
    this.cur.push({ k: 'soft', id: this.id('s'), cx, cy, rx, ry, rot, color, o });
  }

  /**
   * Everything drawn from here until the next stage belongs to `name`, which
   * moves about (ox, oy) in scene units: where the liquid rises from, where
   * the garnish lands. Only at the top level, outside any clip. With `bands`,
   * its strokes stay apart by height (each carries its band), so a hand can
   * draw them from the top down.
   */
  stage(name: StageName, ox = SCENE_SIZE / 2, oy = SCENE_SIZE / 2, bands = 0) {
    this.flush();
    while (this.stack.length > 1) this.stack.pop();
    const st: SceneEl = { k: 'stage', name, ox: n1(ox), oy: n1(oy), children: [] };
    this.root.push(st);
    this.stack.push(st.children);
    this.floor = 2;
    this.bands = bands;
  }

  /** Everything until end() is clipped to this outline. */
  begin(clip: Pt[]) {
    this.flush();
    const g: SceneEl = { k: 'group', id: this.id('c'), clip: pathOf(clip, true), children: [] };
    this.cur.push(g);
    this.stack.push(g.children);
  }

  end() {
    this.flush();
    // A stage isn't a clip: end() leaves it open.
    if (this.stack.length > this.floor) this.stack.pop();
  }

  done(): Scene {
    this.flush();
    while (this.stack.length > 1) this.stack.pop();
    return { size: SCENE_SIZE, els: this.root };
  }
}
