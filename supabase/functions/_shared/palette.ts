// Picks a drink's colour field from its picture: the dominant liquid or garnish
// colour plus a deep and a light companion, as lowercase "#rrggbb" strings in
// that order. Pure (no Deno or Node APIs), so the app's unit checks can run it.
//
// A plain average of a bar photo is mud: the bar is dark, the paper behind a
// sketch is white, glass is grey, and the room around the drink is big. So:
//   1. near-black, near-white and grey pixels are dropped;
//   2. the rest are weighted towards the middle of the frame, where hero shots
//      put the drink;
//   3. a small median cut splits them into boxes, and the box that is both
//      common and a saturated mid-tone wins.

type Rgb = [number, number, number];
/** A sampled pixel and how much it counts (more near the middle). */
type Sample = [r: number, g: number, b: number, weight: number];
type Hsl = { h: number; s: number; l: number };

/** Sample at most this many pixels; a palette doesn't need more. */
const MAX_SAMPLES = 20_000;
const MAX_BOXES = 16;
/**
 * Spread of the centre weighting, as a share of the frame. A pixel on the edge
 * counts about a quarter as much as one in the middle, a corner about 6%.
 */
const CENTRE_SPREAD = 0.3;
/**
 * Colour filters, strict first. A pixel counts as colour at `minChroma` or more,
 * and a pass needs `minShare` of the (weighted) opaque pixels. The second pass
 * catches the faint wash of wine in a pencil sketch; paper and JPEG noise stay
 * under it.
 */
const PASSES = [
  { minChroma: 0.12, minShare: 0.005 },
  { minChroma: 0.06, minShare: 0.01 },
];
/** A companion taken from the picture must sit this close to the dominant hue. */
const MAX_HUE_DISTANCE = 45;

/**
 * Returns [dominant, deep, light], or [] when the picture is all background
 * (a greyscale pencil sketch, say). `rgba` is 4 bytes per pixel, `width` pixels
 * to a row.
 */
export function pickPalette(rgba: ArrayLike<number>, width: number): string[] {
  const pixelCount = Math.floor(rgba.length / 4);
  if (pixelCount === 0 || width <= 0) return [];
  const height = Math.ceil(pixelCount / width);
  const stride = Math.max(1, Math.floor(pixelCount / MAX_SAMPLES));
  const opaque: Sample[] = [];
  let opaqueWeight = 0;
  for (let p = 0; p < pixelCount; p += stride) {
    const i = p * 4;
    if (rgba[i + 3] < 128) continue;
    const dx = ((p % width) + 0.5) / width - 0.5;
    const dy = (Math.floor(p / width) + 0.5) / height - 0.5;
    const weight = Math.exp(-(dx * dx + dy * dy) / (2 * CENTRE_SPREAD ** 2));
    opaque.push([rgba[i], rgba[i + 1], rgba[i + 2], weight]);
    opaqueWeight += weight;
  }

  let colourful: Sample[] = [];
  let colourWeight = 0;
  for (const { minChroma, minShare } of PASSES) {
    colourful = opaque.filter((pixel) => !isBackground(pixel, minChroma));
    colourWeight = totalWeight(colourful);
    if (colourful.length > 0 && colourWeight >= opaqueWeight * minShare) break;
    colourful = [];
  }
  if (colourful.length === 0) return [];

  const boxes = medianCut(colourful, MAX_BOXES).map((pixels) => {
    const hsl = toHsl(average(pixels));
    return { hsl, share: totalWeight(pixels) / colourWeight };
  });

  let dominant = boxes[0];
  for (const box of boxes) {
    if (score(box.hsl, box.share) > score(dominant.hsl, dominant.share)) dominant = box;
  }
  const d = dominant.hsl;

  const nearDominant = boxes.filter((b) => b !== dominant && hueDistance(b.hsl.h, d.h) <= MAX_HUE_DISTANCE);
  const deepFromPicture = mostCommon(nearDominant.filter((b) => b.hsl.l <= 0.35));
  const lightFromPicture = mostCommon(nearDominant.filter((b) => b.hsl.l >= 0.7));

  const deepL = Math.max(0.08, Math.min(0.22, d.l - 0.15));
  const deep = deepFromPicture
    ? { h: deepFromPicture.h, s: Math.min(deepFromPicture.s, 0.7), l: Math.min(deepFromPicture.l, deepL + 0.08) }
    : { h: d.h, s: Math.min(d.s, 0.6), l: deepL };

  const lightL = Math.min(0.95, Math.max(0.86, d.l + 0.15));
  const light = lightFromPicture
    ? { h: lightFromPicture.h, s: Math.min(lightFromPicture.s, 0.6), l: Math.max(lightFromPicture.l, lightL) }
    : { h: d.h, s: Math.min(d.s, 0.5), l: lightL };

  return [toHex(fromHsl(d)), toHex(fromHsl(deep)), toHex(fromHsl(light))];
}

/** Near-black, near-white or grey: the bar, the paper, the glass. */
function isBackground([r, g, b]: Sample, minChroma: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 510;
  const chroma = (max - min) / 255;
  return lightness < 0.1 || lightness > 0.94 || chroma < minChroma;
}

function totalWeight(pixels: Sample[]): number {
  let sum = 0;
  for (const p of pixels) sum += p[3];
  return sum;
}

/** Common and saturated wins; very dark and very light boxes count for less. */
function score({ s, l }: Hsl, share: number): number {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const midTone = 1 - Math.min(1, Math.abs(l - 0.5) * 1.6);
  return share ** 0.5 * chroma ** 2.5 * (0.2 + midTone);
}

function mostCommon(boxes: { hsl: Hsl; share: number }[]): Hsl | null {
  let best: { hsl: Hsl; share: number } | null = null;
  for (const box of boxes) if (!best || box.share > best.share) best = box;
  return best?.hsl ?? null;
}

/** Splits the box with the widest channel at its median until there are `max`. */
function medianCut(pixels: Sample[], max: number): Sample[][] {
  const boxes = [pixels];
  while (boxes.length < max) {
    let target = -1;
    let channel = 0;
    let widest = 0;
    boxes.forEach((box, index) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255;
        let hi = 0;
        for (const p of box) {
          if (p[c] < lo) lo = p[c];
          if (p[c] > hi) hi = p[c];
        }
        const weighted = (hi - lo) * Math.sqrt(box.length);
        if (weighted > widest) {
          widest = weighted;
          target = index;
          channel = c;
        }
      }
    });
    if (target < 0) break;
    const box = boxes[target].sort((a, b) => a[channel] - b[channel]);
    const mid = box.length >> 1;
    boxes.splice(target, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes;
}

function average(pixels: Sample[]): Rgb {
  const sum: Rgb = [0, 0, 0];
  let weight = 0;
  for (const [r, g, b, w] of pixels) {
    sum[0] += r * w;
    sum[1] += g * w;
    sum[2] += b * w;
    weight += w;
  }
  return [sum[0] / weight, sum[1] / weight, sum[2] / weight];
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function toHsl([r, g, b]: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function fromHsl({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}
