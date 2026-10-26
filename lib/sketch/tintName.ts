import { SKETCH_TINTS, type SketchTint } from '../../constants/sketch';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** The house colour closest to `hex`: how a photo's colour is named ("Amber from the photo"). */
export function nearestTint(hex: string): SketchTint {
  const [r, g, b] = rgb(hex);
  let best: SketchTint = SKETCH_TINTS[0];
  let bestDistance = Infinity;
  for (const t of SKETCH_TINTS) {
    const [tr, tg, tb] = rgb(t.hex);
    const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
    if (d < bestDistance) [best, bestDistance] = [t, d];
  }
  return best;
}

/**
 * What a drink's sketch colour is called: Auto, a house colour's name, or
 * the closest one's "from your photo" (any other colour came from a photo).
 */
export function tintName(value: string | null | undefined): string {
  if (!value) return 'Auto';
  return SKETCH_TINTS.find((t) => t.hex === value)?.label ?? `${nearestTint(value).label}, from your photo`;
}
