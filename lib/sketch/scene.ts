// A drawing as a short list of SVG-ready shapes, built like a canvas: the
// painter fills, strokes and clips, and this keeps the order while merging
// strokes of the same weight and tone into one path, so a drawing is a hundred
// or so elements rather than thousands.

import type { Pt } from './geometry';

export const SCENE_SIZE = 512;

export type SceneEl =
  | { k: 'fill'; d: string; color: string; o: number }
  | { k: 'stroke'; d: string; color: string; o: number; w: number; dash: string | null }
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
  | { k: 'group'; id: string; clip: string; children: SceneEl[] };

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
  parts: string[];
}

export class SceneBuilder {
  private readonly root: SceneEl[] = [];
  private readonly stack: SceneEl[][] = [this.root];
  private pending = new Map<string, Pending>();
  private n = 0;

  constructor(private readonly prefix: string) {}

  private get cur() {
    return this.stack[this.stack.length - 1];
  }

  id(kind: string) {
    return `${this.prefix}${kind}${this.n++}`;
  }

  private flush() {
    for (const p of this.pending.values()) this.cur.push({ k: 'stroke', d: p.parts.join(''), color: p.color, o: p.o, w: p.w, dash: p.dash });
    this.pending.clear();
  }

  /** A stroke, merged with others of the same colour, weight, tone and dash until something else is drawn. */
  stroke(pts: Pt[], color: string, o: number, w: number, dash: string | null = null) {
    if (pts.length < 2 || o <= 0.004) return;
    const wq = nearest(WEIGHTS, w);
    const oq = nearest(TONES, o);
    const key = `${color}|${wq}|${oq}|${dash ?? ''}`;
    let p = this.pending.get(key);
    if (!p) {
      p = { color, o: oq, w: wq, dash, parts: [] };
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

  /** Everything until end() is clipped to this outline. */
  begin(clip: Pt[]) {
    this.flush();
    const g: SceneEl = { k: 'group', id: this.id('c'), clip: pathOf(clip, true), children: [] };
    this.cur.push(g);
    this.stack.push(g.children);
  }

  end() {
    this.flush();
    if (this.stack.length > 1) this.stack.pop();
  }

  done(): Scene {
    this.flush();
    while (this.stack.length > 1) this.stack.pop();
    return { size: SCENE_SIZE, els: this.root };
  }
}
