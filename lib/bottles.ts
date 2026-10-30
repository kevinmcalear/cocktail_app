/**
 * Whole bottles to buy for an amount: "2.3 L" is "buy 4 × 700 ml". The
 * bottle's own size when the bar has set one, else the standard Australian
 * spirit bottle, said as an assumption. Pure.
 */

/** A standard spirit bottle in Australia. ponytail: one default for everyone; a bar's region could pick 750 ml later. */
export const DEFAULT_BOTTLE_ML = 700;

export interface Bottles {
  count: number;
  bottleMl: number;
  /** No size was set for this bottle, so it's DEFAULT_BOTTLE_ML. */
  assumed: boolean;
}

/** Whole bottles for `ml`, rounded up; null for nothing to buy. */
export function bottlesFor(ml: number, bottleMl?: number | null): Bottles | null {
  if (!Number.isFinite(ml) || ml <= 0) return null;
  const known = bottleMl != null && Number.isFinite(bottleMl) && bottleMl > 0;
  const size = known ? bottleMl : DEFAULT_BOTTLE_ML;
  // Rounded to a thousandth first, so 1,400 ml in 700s is 2, not 3 after a float slip.
  return { count: Math.ceil(Math.round((ml / size) * 1000) / 1000), bottleMl: size, assumed: !known };
}

const size = (ml: number) => (ml >= 1000 ? `${Math.round(ml / 100) / 10} L` : `${Math.round(ml)} ml`);

/** "buy 4 × 700 ml", or "buy 4 × 700 ml (700 ml assumed)" when the size isn't set. */
export function bottlesText(b: Bottles): string {
  return `buy ${b.count} × ${size(b.bottleMl)}${b.assumed ? ` (${size(b.bottleMl)} assumed)` : ''}`;
}
