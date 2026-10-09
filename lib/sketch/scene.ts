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

export type Bounds = [x0: number, y0: number, x1: number, y1: number];

const grow = (b: Bounds, x: number, y: number, rx: number, ry: number) => {
  b[0] = Math.min(b[0], x - rx);
  b[1] = Math.min(b[1], y - ry);
  b[2] = Math.max(b[2], x + rx);
  b[3] = Math.max(b[3], y + ry);
};

/** Grows `b` to take in path `d` (the M/L/Z paths and relative-arc dots the builder writes), padded by `pad`. False on anything else. */
function addPath(b: Bounds, d: string, pad: number): boolean {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let cmd = '';
  let x = 0;
  let y = 0;
  for (let i = 0; i < tokens.length; ) {
    if (/[A-Za-z]/.test(tokens[i])) {
      cmd = tokens[i++];
      continue;
    }
    const n = (j: number) => Number(tokens[i + j]);
    if (cmd === 'M' || cmd === 'L') {
      x = n(0);
      y = n(1);
      grow(b, x, y, pad, pad);
      i += 2;
    } else if (cmd === 'a') {
      // rx ry rotation large sweep dx dy: the arc stays within its radius of either end.
      const r = Math.max(n(0), n(1)) + pad;
      grow(b, x, y, r, r);
      x += n(5);
      y += n(6);
      grow(b, x, y, r, r);
      i += 7;
    } else return false;
  }
  return true;
}

const EMPTY = (): Bounds => [Infinity, Infinity, -Infinity, -Infinity];

/**
 * The area these elements cover, in scene units, or null when there's
 * nothing (or a path it can't read). AnimatedSketch sizes each moving layer
 * to it: every layer is a bitmap, and a band of pencil needs only its strip.
 */
export function boundsOf(els: SceneEl[]): Bounds | null {
  const walk = (list: SceneEl[], b: Bounds): boolean => {
    for (const el of list) {
      if (el.k === 'fill') {
        if (!addPath(b, el.d, 1)) return false;
      } else if (el.k === 'stroke') {
        if (!addPath(b, el.d, el.w / 2 + 1)) return false;
      } else if (el.k === 'wash') {
        if (!el.ds.every((d) => addPath(b, d, el.edgeW / 2 + 1))) return false;
      } else if (el.k === 'soft') {
        // A turned ellipse's half-width and half-height.
        const [c, s] = [Math.cos(el.rot), Math.sin(el.rot)];
        grow(b, el.cx, el.cy, Math.hypot(el.rx * c, el.ry * s) + 1, Math.hypot(el.rx * s, el.ry * c) + 1);
      } else if (el.k === 'group') {
        // Only what shows through the clip.
        const [inner, clip] = [EMPTY(), EMPTY()];
        if (!walk(el.children, inner) || !addPath(clip, el.clip, 0)) return false;
        if (inner[0] > inner[2]) continue;
        grow(b, Math.max(inner[0], clip[0]), Math.max(inner[1], clip[1]), 0, 0);
        grow(b, Math.min(inner[2], clip[2]), Math.min(inner[3], clip[3]), 0, 0);
      } else if (!walk(el.children, b)) return false;
    }
    return true;
  };
  const b = EMPTY();
  if (!walk(els, b) || b[0] > b[2]) return null;
  return [Math.floor(b[0]), Math.floor(b[1]), Math.ceil(b[2]), Math.ceil(b[3])];
}
