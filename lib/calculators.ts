/**
 * The bar's calculators: water to bring a spirit down, spirit to bring a
 * liquid up, and an amount read in every bar unit. Selling price lives in
 * lib/costing.ts. Pure; the Tools sheet renders them.
 */

import { density, ML_PER_OZ } from '@/lib/drinkMath';

/** Water to add to `volumeMl` at `abv` to reach `targetAbv`; null when the target isn't lower. */
export function waterToDilute(volumeMl: number, abv: number, targetAbv: number): number | null {
  if (!(volumeMl > 0 && abv > 0 && targetAbv > 0) || targetAbv >= abv) return null;
  return volumeMl * (abv / targetAbv - 1);
}

/** Spirit at `spiritAbv` to add to `volumeMl` at `abv` to reach `targetAbv`; null unless the target sits between them. */
export function spiritToProof(volumeMl: number, abv: number, targetAbv: number, spiritAbv: number): number | null {
  if (!(volumeMl > 0 && abv >= 0 && targetAbv > abv && spiritAbv > targetAbv)) return null;
  return (volumeMl * (targetAbv - abv)) / (spiritAbv - targetAbv);
}

/** Ethanol in a volume at an ABV, in ml. */
export function ethanolIn(volumeMl: number, abv: number): number {
  return (volumeMl * abv) / 100;
}

const ML_PER: Record<string, number> = { ml: 1, cl: 10, l: 1000, oz: ML_PER_OZ, 'fl oz': ML_PER_OZ, bsp: 5, barspoon: 5, tsp: 5, tbsp: 15, dash: 0.8, dashes: 0.8, drop: 0.05, drops: 0.05, cup: 240 };
const G_PER: Record<string, number> = { g: 1, kg: 1000 };

export interface Reading {
  unit: string;
  value: number;
  /** "52.6 ml" */
  label: string;
}

const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));
function readingLabel(value: number, unit: string): string {
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${trim(value, digits)} ${unit}`;
}

/**
 * An amount read in the other bar units. Volumes convert straight; weights
 * go through the ingredient's density (a guess from its name and ABV unless
 * it has one). Counts (a twist, a dash of nothing in particular) have no
 * other reading.
 */
export function readings(value: number, unit: string, ingredient?: { name?: string | null; abv?: number | null; density?: number | null }): Reading[] {
  const u = unit.trim().toLowerCase();
  if (!(value > 0)) return [];
  const gPerMl = density(ingredient?.name, ingredient?.abv, ingredient?.density);
  let ml: number | null = null;
  if (u in ML_PER) ml = value * ML_PER[u];
  else if (u in G_PER) ml = (value * G_PER[u]) / gPerMl;
  if (ml === null) return [];
  const out: Reading[] = [
    { unit: 'ml', value: ml, label: readingLabel(ml, 'ml') },
    { unit: 'oz', value: ml / ML_PER_OZ, label: readingLabel(ml / ML_PER_OZ, 'oz') },
    { unit: 'cl', value: ml / 10, label: readingLabel(ml / 10, 'cl') },
    { unit: 'g', value: ml * gPerMl, label: readingLabel(ml * gPerMl, 'g') },
    { unit: 'bsp', value: ml / 5, label: readingLabel(ml / 5, 'bsp') },
  ];
  if (ml <= 10) out.push({ unit: 'dashes', value: ml / 0.8, label: readingLabel(ml / 0.8, 'dashes') });
  const same = u === 'fl oz' ? 'oz' : u === 'dash' ? 'dashes' : u;
  return out.filter((r) => r.unit !== same);
}

/** "300 ml", "1.2 L". */
export function formatMl(ml: number): string {
  return ml >= 1000 ? `${trim(ml / 1000, 2)} L` : `${trim(ml, ml < 10 ? 1 : 0)} ml`;
}
