// A venue logo's edge, and taking its plain background out. Pure (no Deno or
// Node APIs), so upload-bar-logo, the app and its unit checks all run it.
//
// Most logos arrive as a mark on a flat colour (a JPEG, or a PNG with a white
// square behind it). Shown cut to a circle on the dark ground, that colour
// reads as a ring. The edge says how to draw one: `clear` (transparent, draw
// it as it is), `solid` (put it on a tile of that colour, so the edge blends),
// or `busy` (a photo or a mark to the edge: fill the tile with it).
// upload-bar-logo puts the edge in the stored file's name (`logoFileTag`), so
// the app knows it without reading pixels.

export type LogoEdge = { kind: "clear" } | { kind: "solid"; color: string } | { kind: "busy" };

/** Below this alpha a pixel counts as see-through. */
const SEE_THROUGH = 128;
/** A border more than this share see-through is a transparent logo. */
const CLEAR_SHARE = 0.25;
/** A border at least this share one colour is a flat background. */
const FLAT_SHARE = 0.7;
/**
 * How far (RGB distance, 0 to 441) a pixel may be from the background colour
 * and still be background: JPEG noise and an off-white paper, not a pale mark.
 */
export const BACKGROUND_TOLERANCE = 48;
/** The soft edge: pixels this close to the removed background fade by how much of it they hold. */
const FEATHER = 2;
/**
 * A pocket of background colour inside the mark no wider or taller than this
 * share of the logo is a letter's counter, and goes; a ring or a badge's inner
 * circle spans more, and stays.
 */
const COUNTER_SPAN = 0.2;
/** A counter is the background colour itself (on average this close), not a pale colour near it, like cream type. */
const COUNTER_TOLERANCE = 20;

type Pixels = ArrayLike<number>;

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("")}`;
}

function distance(p: Pixels, i: number, r: number, g: number, b: number): number {
  return Math.sqrt((p[i] - r) ** 2 + (p[i + 1] - g) ** 2 + (p[i + 2] - b) ** 2);
}

/** Every pixel index on the image's outer ring, each once. */
function borderPixels(width: number, height: number): number[] {
  const out: number[] = [];
  for (let x = 0; x < width; x++) {
    out.push(x);
    if (height > 1) out.push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    out.push(y * width);
    if (width > 1) out.push(y * width + width - 1);
  }
  return out;
}

/** How a logo meets its edge, from its RGBA pixels (row by row, 4 bytes each). */
export function logoEdge(rgba: Pixels, width: number, height: number): LogoEdge {
  const ring = borderPixels(width, height);
  if (!ring.length) return { kind: "busy" };
  const solid = ring.filter((p) => rgba[p * 4 + 3] >= SEE_THROUGH);
  if ((ring.length - solid.length) / ring.length > CLEAR_SHARE) return { kind: "clear" };

  // The commonest border colour (in steps of 16), then the mean of the pixels near it.
  const buckets = new Map<number, number>();
  let top = -1;
  let topCount = 0;
  for (const p of solid) {
    const i = p * 4;
    const key = ((rgba[i] >> 4) << 8) | ((rgba[i + 1] >> 4) << 4) | (rgba[i + 2] >> 4);
    const count = (buckets.get(key) ?? 0) + 1;
    buckets.set(key, count);
    if (count > topCount) [top, topCount] = [key, count];
  }
  if (top < 0) return { kind: "busy" };
  const seed = [((top >> 8) << 4) + 8, (((top >> 4) & 15) << 4) + 8, ((top & 15) << 4) + 8];
  let n = 0;
  const sum = [0, 0, 0];
  for (const p of solid) {
    if (distance(rgba, p * 4, seed[0], seed[1], seed[2]) > BACKGROUND_TOLERANCE) continue;
    n++;
    for (let c = 0; c < 3; c++) sum[c] += rgba[p * 4 + c];
  }
  if (!n) return { kind: "busy" };
  const [r, g, b] = sum.map((s) => s / n);
  const flat = solid.filter((p) => distance(rgba, p * 4, r, g, b) <= BACKGROUND_TOLERANCE).length;
  return flat / ring.length >= FLAT_SHARE ? { kind: "solid", color: hex(r, g, b) } : { kind: "busy" };
}

/**
 * Takes a flat background out of a logo, in place: flood-fills from the edge
 * through pixels near the background colour (so a shape of the same colour
 * inside the mark stays, unless it's as small as a letter's counter), makes
 * them transparent, and softens
 * the pixels within FEATHER of them by how much background they hold, taking
 * that background out of their colour so no light fringe shows on a dark
 * ground. Returns false (and changes nothing) when there's no flat background.
 */
export function removeLogoBackground(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): boolean {
  const edge = logoEdge(rgba, width, height);
  if (edge.kind !== "solid") return false;
  const bg = [1, 3, 5].map((at) => parseInt(edge.color.slice(at, at + 2), 16));
  // Each pixel's distance from the background, worked out once.
  const d = new Float32Array(width * height);
  for (let p = 0; p < d.length; p++) d[p] = distance(rgba, p * 4, bg[0], bg[1], bg[2]);
  const far = (p: number) => d[p];

  // 1 = background: reached from the edge, or a letter's counter (below).
  const gone = new Uint8Array(width * height);
  // 1 = looked at, as edge background or as a shape inside the mark.
  const seen = new Uint8Array(width * height);
  /** The pixels near the background colour joined to the seeds, each marked seen. */
  const flood = (seeds: number[]): number[] => {
    const region: number[] = [];
    const stack = seeds.filter((p) => !seen[p] && far(p) <= BACKGROUND_TOLERANCE);
    for (const p of stack) seen[p] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      region.push(p);
      const x = p % width;
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (q < 0 || q >= seen.length || seen[q] || far(q) > BACKGROUND_TOLERANCE) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    return region;
  };
  for (const p of flood(borderPixels(width, height).filter((p) => rgba[p * 4 + 3] >= SEE_THROUGH))) gone[p] = 1;
  // A pocket of background colour inside the mark: a small one is a letter's
  // counter (the hole in an O) and goes too, or it shows as a speck on the dark ground.
  for (let p = 0; p < seen.length; p++) {
    if (seen[p] || far(p) > BACKGROUND_TOLERANCE) continue;
    const pocket = flood([p]);
    let [minX, maxX, minY, maxY, sum] = [width, 0, height, 0, 0];
    for (const q of pocket) {
      const x = q % width;
      const y = (q - x) / width;
      [minX, maxX, minY, maxY] = [Math.min(minX, x), Math.max(maxX, x), Math.min(minY, y), Math.max(maxY, y)];
      sum += far(q);
    }
    const small = maxX - minX < COUNTER_SPAN * width && maxY - minY < COUNTER_SPAN * height;
    if (small && sum / pocket.length <= COUNTER_TOLERANCE) for (const q of pocket) gone[q] = 1;
  }

  // The soft edge, worked out before anything changes, so each pixel reads the original.
  const soft: [number, number][] = [];
  for (let p = 0; p < gone.length; p++) {
    if (gone[p]) continue;
    const x = p % width;
    const y = (p - x) / width;
    let near = false;
    let ink = far(p);
    for (let dy = -FEATHER; dy <= FEATHER; dy++) {
      for (let dx = -FEATHER; dx <= FEATHER; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (gone[q]) near = true;
        else ink = Math.max(ink, far(q));
      }
    }
    // Its share of mark: how far it is from the background next to the most mark-like pixel near it.
    if (near) soft.push([p, ink > 0 ? Math.min(1, far(p) / ink) : 1]);
  }

  for (let p = 0; p < gone.length; p++) if (gone[p]) rgba[p * 4 + 3] = 0;
  for (const [p, share] of soft) {
    const i = p * 4;
    if (share < 1 / 255) {
      rgba[i + 3] = 0;
      continue;
    }
    // Seen = share * mark + (1 - share) * background, so mark = background + (seen - background) / share.
    for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(Math.max(0, Math.min(255, bg[c] + (rgba[i + c] - bg[c]) / share)));
    rgba[i + 3] = Math.round(rgba[i + 3] * share);
  }
  return true;
}

/** The part of a stored logo's file name that carries its edge: "clear", "full", or "e" and its colour. */
export function logoFileTag(edge: LogoEdge): string {
  return edge.kind === "solid" ? `e${edge.color.slice(1)}` : edge.kind === "clear" ? "clear" : "full";
}

/** A logo with its background taken out ends in this (after its original's name). */
const NO_BACKGROUND = ".nobg.png";

/**
 * A logo's edge from its URL, when upload-bar-logo named it
 * ("<time>.e1a2b3c.png", "<time>.clear.png", "<time>.full.png", or any
 * "….nobg.png"); null for anything else (older uploads, other hosts).
 */
export function logoEdgeFromUrl(url: string): LogoEdge | null {
  const name = url.split(/[?#]/)[0].split("/").pop() ?? "";
  if (name.endsWith(NO_BACKGROUND)) return { kind: "clear" };
  const tag = name.match(/\.(clear|full|e[0-9a-f]{6})\.png$/)?.[1];
  if (!tag) return null;
  return tag === "clear" ? { kind: "clear" } : tag === "full" ? { kind: "busy" } : { kind: "solid", color: `#${tag.slice(1)}` };
}

/** Where a logo with its background taken out is stored: beside its original. */
export function noBackgroundPath(path: string): string {
  return path.replace(/\.png$/, "") + NO_BACKGROUND;
}

/** The original of a logo with its background taken out, else null. */
export function logoWithBackground(url: string): string | null {
  const [base, query] = url.split(/(?=[?#])/);
  return base.endsWith(NO_BACKGROUND) ? base.slice(0, -NO_BACKGROUND.length) + ".png" + (query ?? "") : null;
}
