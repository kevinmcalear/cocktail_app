/**
 * Recipe amounts in comparable units, for scaling and summing. Volumes become
 * ml, weights become g; anything else ("each", "leaves") stays a count in its
 * own unit and only sums with the same unit.
 */

export type QuantityKind = 'ml' | 'g' | 'count';

export interface Quantity {
  kind: QuantityKind;
  value: number;
  /** The unit for counts ("each", "leaves"); "ml" or "g" otherwise. */
  unit: string;
}

// ponytail: bar units only. Dashes and barspoons are approximate, which is
// fine for prep and ordering, never for a spec.
const VOLUME_ML: Record<string, number> = {
  ml: 1, cl: 10, dl: 100, l: 1000, litre: 1000, liter: 1000,
  oz: 29.57, 'fl oz': 29.57, dash: 0.8, dashes: 0.8, barspoon: 5, bsp: 5, tsp: 5, tbsp: 15, cup: 240,
};
const WEIGHT_G: Record<string, number> = { g: 1, kg: 1000, gram: 1, grams: 1 };

export function toQuantity(amount: number | string | null | undefined, unit: string | null | undefined): Quantity | null {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (n === null || n === undefined || Number.isNaN(n) || n <= 0) return null;
  const u = (unit ?? '').trim().toLowerCase();
  if (u in VOLUME_ML) return { kind: 'ml', value: n * VOLUME_ML[u], unit: 'ml' };
  if (u in WEIGHT_G) return { kind: 'g', value: n * WEIGHT_G[u], unit: 'g' };
  return { kind: 'count', value: n, unit: u || 'each' };
}

/** Same kind (and, for counts, same unit), so they can be added or divided. */
export function sameKind(a: Quantity, b: Quantity): boolean {
  return a.kind === b.kind && (a.kind !== 'count' || a.unit === b.unit);
}

export function scale(q: Quantity, by: number): Quantity {
  return { ...q, value: q.value * by };
}

/** "1.8 L", "360 ml", "2 kg", "12 limes". */
export function formatQuantity(q: Quantity): string {
  const round = (v: number) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
  if (q.kind === 'ml') return q.value >= 1000 ? `${round(q.value / 1000)} L` : `${round(q.value)} ml`;
  if (q.kind === 'g') return q.value >= 1000 ? `${round(q.value / 1000)} kg` : `${round(q.value)} g`;
  return `${round(q.value)} ${q.unit}`;
}
