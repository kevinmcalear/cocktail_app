// Draw my glass: a glass's outline traced from someone's own photo, the way
// the catalog's glasses were traced from makers' photos (scripts in the
// research pass of 24-25 Oct 2026; glass_models.outline). No AI and nothing
// made up: it models the plain wall behind the glass from the photo's edges,
// finds the glass's edge row by row, reads the rim and the foot as ovals
// (their centres set the height) and scales the shape to the one number
// typed. When it can't see one clean glass it says why and stops.

import type { GlassOutline } from './sketch/outline';

/** A photo's pixels, RGBA, as a canvas or a JPEG decoder gives them. */
export interface TracePixels {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

/** The one number that sizes it: height rim to table, or capacity to the brim. */
export type TraceSize = { height_mm: number } | { capacity_ml: number };

/**
 * Why it stopped: edge, nothing plain behind it or no edge to follow; several,
 * more than one thing in the frame; cut, the glass touches the photo's edge;
 * small, the glass is too small in the photo; above, taken from above.
 */
export type TraceFail = 'edge' | 'several' | 'cut' | 'small' | 'above';

export interface TracedGlass {
  outline: GlassOutline;
  /** The traced line over the photo, left and right sides, as [x, y] in 0..1 of the photo. */
  overlay: { left: [number, number][]; right: [number, number][] };
}

export type TraceResult = { ok: true; glass: TracedGlass } | { ok: false; why: TraceFail };

// Rows the silhouette is resampled to, whatever the photo's size.
const ROWS = 600;
// Photos are read at about this many rows: enough for a 2% width, quick on a phone.
const READ_ROWS = 800;
// How far from the wall a pixel has to be to count as glass.
const EDGE = 16;
// A traced glass's outer volume holds this many times its capacity to the brim (walls, foot, the brim's last mm).
const FULL = 1.15;

/** Traces the glass in a photo and sizes it. */
export function traceGlass(photo: TracePixels, size: TraceSize): TraceResult {
  const read = readPhoto(photo);
  if ('why' in read) return { ok: false, why: read.why };
  const s = silhouette(read);
  if ('why' in s) return { ok: false, why: s.why };
  const unit = outlineOf(s, 100);
  const height = 'height_mm' in size ? size.height_mm : 100 * Math.cbrt((size.capacity_ml * FULL) / Math.max(1, volumeMl(unit)));
  const outline = outlineOf(s, height);
  return { ok: true, glass: { outline: stored(outline), overlay: overlayOf(s, outline, read) } };
}

/** The same traced shape sized to a corrected number (Fix the height). */
export function resizeOutline(o: GlassOutline, size: TraceSize): GlassOutline {
  const k = 'height_mm' in size ? size.height_mm / o.height_mm : Math.cbrt(size.capacity_ml / Math.max(1, holdsMl(o)));
  const mm = (v: number | null | undefined) => (v == null ? v : r1(v * k));
  const pairs = (p: [number, number][] | null | undefined) => p?.map(([d, w]): [number, number] => [r1(d * k), r1(w * k)]);
  return {
    ...o,
    height_mm: r1(o.height_mm * k),
    rim_mm: r1(o.rim_mm * k),
    widest_mm: r1(o.widest_mm * k),
    outline: pairs(o.outline)!,
    bowl_mm: mm(o.bowl_mm),
    stem_to_mm: mm(o.stem_to_mm),
    stem_mm: mm(o.stem_mm),
    foot_mm: mm(o.foot_mm),
    stem_profile: pairs(o.stem_profile),
    foot_profile: pairs(o.foot_profile),
  };
}

/** What it holds to the brim, worked out from the shape, in ml. */
export function holdsMl(o: GlassOutline): number {
  return volumeMl(o) / FULL;
}

// --- Reading the photo ---

interface Read {
  W: number;
  H: number;
  /** How far each pixel is from the wall behind it, 0 to 255. */
  off: Uint8Array;
  /** Photo pixels per read pixel, to map back. */
  scale: number;
}

function readPhoto({ width, height, data }: TracePixels): Read | { why: TraceFail } {
  const step = Math.max(1, Math.round(height / READ_ROWS));
  const W = Math.floor(width / step);
  const H = Math.floor(height / step);
  if (W < 60 || H < 60) return { why: 'small' };
  // Each read pixel is the average of the block it stands for, so a thin edge isn't skipped.
  const lum = new Float32Array(W * H);
  for (let y = 0; y < H * step; y++) {
    for (let x = 0; x < W * step; x++) {
      const i = (y * width + x) * 4;
      lum[Math.floor(y / step) * W + Math.floor(x / step)] += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / (step * step);
    }
  }
  // The wall, modelled from the photo's four edges (a Coons patch), so a soft
  // gradient or a vignette isn't taken for glass.
  const k = 6;
  const med = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1];
  const at = (x: number, y: number) => lum[y * W + x];
  const L = Array.from({ length: H }, (_, y) => med(Array.from({ length: k }, (_, i) => at(i + 1, y))));
  const R = Array.from({ length: H }, (_, y) => med(Array.from({ length: k }, (_, i) => at(W - 2 - i, y))));
  const T = Array.from({ length: W }, (_, x) => med(Array.from({ length: k }, (_, i) => at(x, i + 1))));
  const B = Array.from({ length: W }, (_, x) => med(Array.from({ length: k }, (_, i) => at(x, H - 2 - i))));
  const smooth = (c: number[]) => c.map((_, i) => med(c.slice(Math.max(0, i - 15), i + 16)));
  const [sL, sR, sT, sB] = [L, R, T, B].map(smooth);
  // How far an edge strays from its own running average: a plain wall barely
  // does, shelves, bottles or a pattern do (a median would keep their steps).
  const rough = (c: number[]) =>
    c.reduce((a, v, i) => {
      const w = c.slice(Math.max(0, i - 15), i + 16);
      return a + Math.abs(v - w.reduce((p, q) => p + q, 0) / w.length);
    }, 0) / c.length;
  // Bottles, a bar top or a patterned wall around the edges: there's no plain wall to follow the glass against.
  const sides = Math.max(rough(L), rough(R));
  const ends = Math.max(rough(T), rough(B));
  if (sides > 8) return { why: 'edge' };
  // A table edge or a floor line can cross the bottom: then each row is modelled from its two sides alone.
  const patch = ends <= 8;
  const off = new Uint8Array(W * H);
  const c00 = sT[0];
  const c10 = sT[W - 1];
  const c01 = sB[0];
  const c11 = sB[W - 1];
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const sidesBg = (1 - u) * sL[y] + u * sR[y];
      const bg = patch ? (1 - v) * sT[x] + v * sB[x] + sidesBg - ((1 - u) * (1 - v) * c00 + u * (1 - v) * c10 + (1 - u) * v * c01 + u * v * c11) : sidesBg;
      off[y * W + x] = Math.min(255, Math.abs(bg - lum[y * W + x]));
    }
  }
  return { W, H, off, scale: step };
}

// --- The glass's silhouette ---

interface Silhouette {
  /** Half-width per resampled row, rim to table, in read pixels per row (ROWS rows). */
  hw: number[];
  /** Where it sits in the read photo: its top row, rows spanned, centre column. */
  top: number;
  len: number;
  cx: number;
}

function silhouette({ W, H, off }: Read): Silhouette | { why: TraceFail } {
  const glass = (x: number, y: number) => off[y * W + x] > EDGE;
  // Where the glass starts, looking in from one side: a clear mark, or two faint ones together (not a speck).
  const edge = (x: number, y: number, inward: number) => off[y * W + x] > 2 * EDGE || (glass(x, y) && glass(x + inward, y));
  const Ls: number[] = [];
  const Rs: number[] = [];
  for (let y = 0; y < H; y++) {
    let l = -1;
    let r = -1;
    for (let x = 1; x < W - 1; x++)
      if (edge(x, y, 1)) {
        l = x;
        break;
      }
    for (let x = W - 2; x > 0; x--)
      if (edge(x, y, -1)) {
        r = x;
        break;
      }
    Ls.push(l);
    Rs.push(r);
  }
  const on = (y: number) => Ls[y] >= 0 && Rs[y] - Ls[y] > 3;
  // The tallest band of rows is the glass; a speck above or a line below sits apart.
  const bands: [number, number][] = [];
  const gap = Math.max(3, Math.round(H * 0.015));
  let b0 = -1;
  let last = -1;
  for (let y = 0; y < H; y++) {
    if (!on(y)) continue;
    if (b0 < 0) b0 = y;
    else if (y - last > gap) {
      bands.push([b0, last]);
      b0 = y;
    }
    last = y;
  }
  if (b0 >= 0) bands.push([b0, last]);
  if (!bands.length) return { why: 'edge' };
  const [top, bottom] = bands.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
  if (bottom - top < H * 0.25) return { why: 'small' };
  // Touching the top or the bottom of the frame: its rim or its foot is cut off.
  if (top <= 2 || bottom >= H - 3) return { why: 'cut' };
  // Objects side by side leave empty columns between them.
  let minL = W;
  let maxR = 0;
  for (let y = top; y <= bottom; y++)
    if (on(y)) {
      minL = Math.min(minL, Ls[y]);
      maxR = Math.max(maxR, Rs[y]);
    }
  if (minL <= 2 || maxR >= W - 3) return { why: 'cut' };
  const ink: { from: number; to: number; n: number }[] = [];
  const apart = Math.max(3, Math.round(W * 0.01));
  let empty = apart;
  for (let x = minL; x <= maxR; x++) {
    let n = 0;
    for (let y = top; y <= bottom; y++) if (glass(x, y)) n++;
    if (!n) {
      empty++;
      continue;
    }
    const cur = ink.at(-1);
    if (cur && empty < apart) {
      cur.to = x;
      cur.n += n;
    } else ink.push({ from: x, to: x, n });
    empty = 0;
  }
  // A whole object spans most of its own width in some of its rows (a bowl, a
  // base). One wall of a clear glass never does: a see-through stem leaves
  // empty columns between a glass's two halves, so halves side by side are one.
  const isWhole = (s: { from: number; to: number }) => {
    const spans: number[] = [];
    for (let y = top; y <= bottom; y++) {
      let l = -1;
      let r = -1;
      for (let x = s.from; x <= s.to; x++)
        if (glass(x, y)) {
          if (l < 0) l = x;
          r = x;
        }
      if (l >= 0) spans.push(r - l);
    }
    return spans.sort((a, b) => a - b)[Math.floor(spans.length * 0.85)] >= (s.to - s.from) * 0.5;
  };
  const objects: { from: number; to: number; n: number; whole: boolean }[] = [];
  for (const s of ink) {
    const whole = isWhole(s);
    const prev = objects.at(-1);
    if (prev && !prev.whole && !whole) {
      prev.to = s.to;
      prev.n += s.n;
    } else objects.push({ ...s, whole });
  }
  const big = objects.filter((s) => s.to - s.from >= W * 0.06);
  const total = big.reduce((a, s) => a + s.n, 0);
  if (big.length > 1 && Math.max(...big.map((s) => s.n)) < total * 0.85) return { why: 'several' };
  // One object with crumbs beside it: keep to the object.
  const one = big.length ? big.reduce((a, s) => (s.n > a.n ? s : a)) : { from: minL, to: maxR };
  const xa = Math.max(0, one.from - 2);
  const xb = Math.min(W - 1, one.to + 2);
  const L: number[] = [];
  const R: number[] = [];
  for (let y = top; y <= bottom; y++) {
    let l = -1;
    let r = -1;
    for (let x = xa; x < xb; x++)
      if (edge(x, y, 1)) {
        l = x;
        break;
      }
    for (let x = xb; x > xa; x--)
      if (edge(x, y, -1)) {
        r = x;
        break;
      }
    L.push(l);
    R.push(r);
  }
  const tall = bottom - top;
  // The centre from the rim's rows, where a shadow on one side can't pull it over.
  const mids: number[] = [];
  for (let i = 0; i < tall * 0.1; i++) if (L[i] >= 0 && R[i] > L[i]) mids.push((L[i] + R[i]) / 2);
  if (!mids.length) return { why: 'edge' };
  const cx = mids.sort((a, b) => a - b)[mids.length >> 1];
  // Each row's half-width: the two sides' average when they agree, else the nearer (a shadow widens one side only).
  const raw = L.map((l, i) => {
    if (l < 0 || R[i] <= l) return 0;
    const a = cx - l;
    const b = R[i] - cx;
    return Math.max(0, Math.abs(a - b) < 0.08 * (a + b) ? (a + b) / 2 : Math.min(a, b));
  });
  if (raw.filter((w) => w === 0).length > raw.length * 0.04) return { why: 'edge' };
  // From above, the rim reads as a tall oval: the outline takes long to reach its width.
  const topMax = Math.max(...raw.slice(0, Math.round(raw.length * 0.25)));
  const reached = raw.findIndex((w) => w >= topMax * 0.9);
  if (reached > raw.length * 0.15) return { why: 'above' };
  const rs = Array.from({ length: ROWS }, (_, i) => raw[Math.round((i / (ROWS - 1)) * (raw.length - 1))] * (ROWS / raw.length));
  // A 9-row median: wide enough to erase a highlight, too narrow to soften a real shoulder.
  const hw = rs.map((_, i) => {
    const w = rs.slice(Math.max(0, i - 4), i + 5).sort((a, b) => a - b);
    return w[w.length >> 1];
  });
  return { hw, top, len: raw.length, cx };
}

// --- In millimetres ---

interface Framed extends GlassOutline {
  /** Where the outline sits in the silhouette's rows. */
  frame: { rimRow: number; ground: number; mmPerRow: number };
}

function outlineOf(s: Silhouette, height_mm: number): Framed {
  const hw = s.hw;
  const n = hw.length;
  const win = Math.round(n * 0.07);
  const topMax = Math.max(...hw.slice(0, win));
  const rimRow = Math.max(
    0,
    hw.findIndex((w) => w >= topMax * 0.96),
  );
  const botMax = Math.max(...hw.slice(n - win));
  let ground = n - 1;
  while (ground > n - win && hw[ground] < botMax * 0.96) ground--;
  // The camera looks down a little: the height runs from the rim's oval's centre to the foot's.
  const mm = height_mm / Math.max(1, ground - rimRow);
  const bowlMax = Math.max(...hw.slice(0, Math.round(n * 0.5)));
  const mid = hw.slice(Math.round(n * 0.35), Math.round(n * 0.86));
  const stemmed = Math.min(...mid) < bowlMax * 0.22;
  let bowlEnd = ground;
  let footStart = ground;
  let stemHw = 0;
  if (stemmed) {
    const narrow = mid.filter((w) => w < bowlMax * 0.22).sort((a, b) => a - b);
    stemHw = Math.max(1, narrow[narrow.length >> 1]);
    bowlEnd = hw.findIndex((w, i) => i > rimRow + n * 0.08 && w <= stemHw * 2.6);
    if (bowlEnd < 0) bowlEnd = Math.round(n * 0.5);
    while (footStart > bowlEnd && hw[footStart] > stemHw * 1.8) footStart--;
  }
  const d = (i: number) => r1((i - rimRow) * mm);
  const sample = (from: number, to: number, k: number): [number, number][] =>
    Array.from({ length: k + 1 }, (_, j) => {
      const i = Math.round(from + (j / k) * (to - from));
      return [d(i), r1(2 * hw[i] * mm)];
    });
  let wi = rimRow;
  for (let i = rimRow; i <= bowlEnd; i++) if (hw[i] > hw[wi]) wi = i;
  return {
    height_mm: d(ground),
    rim_mm: r1(2 * topMax * mm),
    widest_mm: r1(2 * hw[wi] * mm),
    stemmed,
    outline: sample(rimRow, bowlEnd, 48),
    ...(stemmed
      ? {
          bowl_mm: d(bowlEnd),
          stem_to_mm: d(footStart),
          stem_mm: r1(2 * stemHw * mm),
          foot_mm: r1(2 * botMax * mm),
          stem_profile: sample(bowlEnd, footStart, 12),
          foot_profile: sample(footStart, ground, 6),
        }
      : {}),
    frame: { rimRow, ground, mmPerRow: mm },
  };
}

/** What's stored: the outline, without where it sat in the photo. */
function stored({ frame: _frame, ...o }: Framed): GlassOutline {
  return o;
}

/** The traced bowl's outer volume in ml: to the bowl's end, or most of a tumbler (its base is solid). */
function volumeMl(o: GlassOutline): number {
  const pts = o.stemmed ? o.outline : o.outline.filter(([d]) => d <= o.height_mm * 0.9);
  let v = 0;
  for (let i = 1; i < pts.length; i++) {
    const [d0, a] = pts[i - 1];
    const [d1, b] = pts[i];
    v += (Math.PI * (d1 - d0) * ((a / 2) ** 2 + (a / 2) * (b / 2) + (b / 2) ** 2)) / 3;
  }
  return v / 1000;
}

function overlayOf(s: Silhouette, o: Framed, { W, H }: Read): TracedGlass['overlay'] {
  const { rimRow, mmPerRow } = o.frame;
  const perRow = s.len / ROWS;
  const pts = [...o.outline, ...(o.stem_profile ?? []).slice(1), ...(o.foot_profile ?? []).slice(1)];
  const side = (k: number) =>
    pts.map(([depth, dia]): [number, number] => {
      const y = s.top + (rimRow + depth / mmPerRow) * perRow;
      const x = s.cx + k * (dia / 2 / mmPerRow) * perRow;
      return [r3(x / W), r3(y / H)];
    });
  return { left: side(-1), right: side(1) };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
