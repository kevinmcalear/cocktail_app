// Reads a drink photo for its page (boards Decided-photo-top, -bright,
// Desk-photo-side-*): how bright it is, so a bright photo makes a light page,
// and where it has quiet room for the title, so the title sits in the photo
// or under it, never across the drink. Done once at upload
// (components/drink/drinkImages.ts) and by scripts/backfill-photo-layout.ts
// for older photos; stored on images (brightness, text_zone). Pure (no Deno,
// Node or app APIs). Checked on real photos by lib/photoTitle.check.ts.
//
// Quiet room is a run of rows with little detail and an even tone across the
// width a title takes: sky, a wall, a dark bar. The drink, its garnish and a
// busy back bar are detail, so the room never crosses them.

/** Where the title can go: a band of the photo as shares of its height (0 top, 1 bottom), and how light it is. */
export interface TextZone {
  top: number;
  bottom: number;
  /** Lightness (L*, 0 to 1) of the band's lighter parts: the 90th percentile, what text has to read against. */
  light: number;
}

export interface PhotoLayout {
  /** The photo's mean lightness (L*, 0 to 1). */
  brightness: number;
  /** Its quiet room, or null when it has none worth a title. */
  textZone: TextZone | null;
}

/** Cells across the photo: enough to see a glass's edge, few enough to read fast on a phone. */
const GRID = 48;
/** The width a title takes: the page's gutters off each side. */
const SPAN = [0.06, 0.94] as const;
/** A cell is busy past this much detail: its own spread plus its biggest step to a neighbour, in L*. */
const BUSY = 0.06;
/** Busy cells a quiet row may still have: a speck of dust or a far highlight. */
const STRAYS = 1;
/** And below this spread of tone across the row (a window on one side, a dark wall on the other, isn't room). */
const QUIET_SPREAD = 0.09;
/** Room shorter than this share of the photo isn't worth keeping: no layout fits a title in it. */
const MIN_ROOM = 0.08;

/** sRGB 0-255 to L* (0 to 1). */
function lightness(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y) / 100;
}

/** L* (0 to 1) back to relative luminance (0 to 1), for WCAG contrast. */
export function luminanceOf(l: number): number {
  const L = l * 100;
  return L > 8 ? ((L + 16) / 116) ** 3 : L / (24389 / 27);
}

/** Reads a photo's RGBA pixels (any size; a few hundred pixels across is plenty). */
export function readPhotoLayout(rgba: ArrayLike<number>, width: number, height: number): PhotoLayout {
  const cols = Math.min(GRID, width);
  const cell = width / cols;
  const rows = Math.max(1, Math.round(height / cell));
  const mean = new Float64Array(cols * rows);
  const spread = new Float64Array(cols * rows);
  // Each cell's mean lightness and its spread (standard deviation).
  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor((r * height) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((r + 1) * height) / rows));
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * cell);
      const x1 = Math.max(x0 + 1, Math.floor((c + 1) * cell));
      let sum = 0;
      let sq = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          const l = lightness(rgba[i], rgba[i + 1], rgba[i + 2]);
          sum += l;
          sq += l * l;
          n++;
        }
      }
      const m = sum / n;
      mean[r * cols + c] = m;
      spread[r * cols + c] = Math.sqrt(Math.max(0, sq / n - m * m));
    }
  }

  let total = 0;
  for (const m of mean) total += m;
  const brightness = total / mean.length;

  // Which rows a title could sit on.
  const c0 = Math.floor(cols * SPAN[0]);
  const c1 = Math.ceil(cols * SPAN[1]);
  const quiet: boolean[] = [];
  for (let r = 0; r < rows; r++) {
    let busy = 0;
    const tones: number[] = [];
    for (let c = c0; c < c1; c++) {
      const i = r * cols + c;
      const m = mean[i];
      const right = c + 1 < cols ? Math.abs(mean[i + 1] - m) : 0;
      const below = r + 1 < rows ? Math.abs(mean[i + cols] - m) : 0;
      const above = r > 0 ? Math.abs(mean[i - cols] - m) : 0;
      // Any one busy cell counts: a thin stem is only a cell wide, and it's still the drink.
      if (spread[i] + Math.max(right, below, above) > BUSY) busy++;
      tones.push(m);
    }
    tones.sort((a, b) => a - b);
    // The middle 90% of the row's tones: one stray highlight doesn't spoil it.
    const even = tones[Math.floor(tones.length * 0.95) - 1] - tones[Math.floor(tones.length * 0.05)];
    quiet.push(busy <= STRAYS && even <= QUIET_SPREAD);
  }

  // The longest run of quiet rows, a single noisy row inside it forgiven.
  let best: [number, number] | null = null;
  let start = -1;
  for (let r = 0; r <= rows; r++) {
    const ok = r < rows && (quiet[r] || (start >= 0 && r + 1 < rows && quiet[r + 1]));
    if (ok && start < 0) start = r;
    if (!ok && start >= 0) {
      if (!best || r - start > best[1] - best[0]) best = [start, r];
      start = -1;
    }
  }
  if (!best || (best[1] - best[0]) / rows < MIN_ROOM) return { brightness: round(brightness), textZone: null };

  const zoneTones: number[] = [];
  for (let r = best[0]; r < best[1]; r++) for (let c = c0; c < c1; c++) zoneTones.push(mean[r * cols + c]);
  zoneTones.sort((a, b) => a - b);
  const light = zoneTones[Math.min(zoneTones.length - 1, Math.floor(zoneTones.length * 0.9))];
  return { brightness: round(brightness), textZone: { top: round(best[0] / rows), bottom: round(best[1] / rows), light: round(light) } };
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** The width a photo is read at, everywhere: the phone and the web shrink it to this before reading, the backfill too, so all agree. */
export const LAYOUT_WIDTH = 192;

/** A photo shrunk to LAYOUT_WIDTH (box filter), for readers that get it full size (the backfill, the checks). */
export function shrinkForLayout(rgba: ArrayLike<number>, width: number, height: number): { rgba: Uint8ClampedArray; width: number; height: number } {
  const w = Math.min(LAYOUT_WIDTH, width);
  const h = Math.max(1, Math.round((height * w) / width));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / w));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * width + xx) * 4;
          r += rgba[i];
          g += rgba[i + 1];
          b += rgba[i + 2];
          n++;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  }
  return { rgba: out, width: w, height: h };
}

/** images.text_zone as the app reads it, or null when it isn't one (left out, or written by something else). */
export function asTextZone(value: unknown): TextZone | null {
  if (!value || typeof value !== 'object') return null;
  const { top, bottom, light } = value as Record<string, unknown>;
  const share = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 1;
  return share(top) && share(bottom) && share(light) && bottom > top ? { top, bottom, light } : null;
}
