/**
 * Where each of a logo's colours sits in it (canvas Theme-flow-3: "pins where
 * each colour sits on the logo"), read from a small copy of the logo's pixels
 * (lib/logoPixels). Each pixel belongs to the nearest of the colours, if any is
 * near; a colour's pin goes at the point deepest inside its own pixels, so a
 * ring gets its pin on the ring and a disc behind a mark gets it clear of the
 * mark, never at an average that falls on something else.
 */

/** A colour's place in the logo, as fractions of the image's width and height. */
export interface LogoPin {
  hex: string;
  x: number;
  y: number;
}

/** How far (0 to 441, RGB) a pixel can be from a colour and still count as it: its bucket at upload is 24 a channel, plus the logo's soft edges. */
const NEAR = 60;
/** Fainter than this (alpha) is background, as the upload's colour rule reads it. */
const SEEN = 128;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Each pixel's colour: the index of the nearest colour within NEAR, or -1. */
function owners(rgba: ArrayLike<number>, count: number, colours: number[][]): Int8Array {
  const owner = new Int8Array(count).fill(-1);
  for (let p = 0; p < count; p++) {
    if (rgba[p * 4 + 3] < SEEN) continue;
    let best = NEAR;
    for (let t = 0; t < colours.length; t++) {
      const [r, g, b] = colours[t];
      const d = Math.hypot(rgba[p * 4] - r, rgba[p * 4 + 1] - g, rgba[p * 4 + 2] - b);
      if (d < best) {
        best = d;
        owner[p] = t;
      }
    }
  }
  return owner;
}

/**
 * How deep each of one colour's pixels sits inside it: the distance to the
 * nearest pixel that isn't it, the image's edge counting as not it (a chamfer
 * distance, two passes).
 */
function depths(mine: (p: number) => boolean, width: number, height: number): Float32Array {
  const d = new Float32Array(width * height);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : d[y * width + x]);
  for (let p = 0; p < d.length; p++) d[p] = mine(p) ? Infinity : 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (d[p]) d[p] = Math.min(d[p], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + Math.SQRT2, at(x + 1, y - 1) + Math.SQRT2);
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x;
      if (d[p]) d[p] = Math.min(d[p], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + Math.SQRT2, at(x - 1, y + 1) + Math.SQRT2);
    }
  }
  return d;
}

/**
 * Each colour's pin in an RGBA image `width` by `height`; a colour the logo
 * doesn't have (a photo's colour, one read too loosely) gets none. Ties for the
 * deepest point go to the one nearest the middle of that colour's pixels.
 */
export function pinsFromPixels(rgba: ArrayLike<number>, width: number, height: number, colours: string[]): LogoPin[] {
  const owner = owners(rgba, width * height, colours.map(rgb));
  return colours.flatMap((hex, t) => {
    const d = depths((p) => owner[p] === t, width, height);
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let p = 0; p < d.length; p++) {
      if (!d[p]) continue;
      sx += p % width;
      sy += Math.floor(p / width);
      n++;
    }
    if (!n) return [];
    const [cx, cy] = [sx / n, sy / n];
    let best = -1;
    let deepest = 0;
    let near = Infinity;
    for (let p = 0; p < d.length; p++) {
      if (!d[p] || d[p] < deepest) continue;
      const off = Math.hypot((p % width) - cx, Math.floor(p / width) - cy);
      if (d[p] > deepest || off < near) [best, deepest, near] = [p, d[p], off];
    }
    return [{ hex, x: ((best % width) + 0.5) / width, y: (Math.floor(best / width) + 0.5) / height }];
  });
}

/** An opaque logo sits in this share of its tile, as the home-screen icon does (LogoImage, venue-app). */
export const LOGO_INSET = 0.8;

/** Where a logo image of this aspect (width over height) is drawn in a LogoImage tile `size` square, by its edge (LogoImage). */
export function logoRect(edge: 'solid' | 'clear' | 'busy' | null, size: number, aspect: number): { left: number; top: number; width: number; height: number } {
  // On a flat colour: fitted inside the inset. Transparent: fitted to the tile. Busy or unknown: it fills the tile.
  const box = edge === 'solid' ? Math.round(size * LOGO_INSET) : size;
  const fit = edge === 'busy' || edge === null ? Math.max : Math.min;
  const scale = fit(box / aspect, box);
  const [width, height] = [scale * aspect, scale];
  return { left: (size - width) / 2, top: (size - height) / 2, width, height };
}

/**
 * A logo's colours to offer: the ones already known (a fresh upload's, or the
 * one saved), then what its pixels show, without near repeats, at most three
 * (Theme-flow-3: "up to three tiles").
 */
export function mergeLogoColours(known: string[], read: string[]): string[] {
  const out: string[] = [];
  for (const hex of [...known, ...read].map((h) => h.toUpperCase())) {
    const [r, g, b] = rgb(hex);
    if (!out.some((o) => Math.hypot(...rgb(o).map((v, i) => v - [r, g, b][i])) < NEAR / 2)) out.push(hex);
  }
  return out.slice(0, 3);
}
