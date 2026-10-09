/**
 * Scaling a prep recipe on the bench: by whole batches, to a target yield, or
 * from what you have of one line ("I've got 320 g of ginger juice"). Pure;
 * components/prep hands it the recipe and the prep row.
 */

import { formatQuantity, toQuantity, type Quantity } from '@/lib/quantity';

export interface RecipeLine {
  id: string;
  name: string;
  amount: number | string | null;
  unit: string | null;
}

export interface ScaledLine extends RecipeLine {
  /** The scaled amount, or "" when the line has none. */
  scaled: string;
}

export interface Totals {
  /** Volume of the lines that are volumes, in ml. */
  ml: number;
  /** Weight of the lines that are weights, in g. */
  g: number;
  /** Lines with no usable amount (counts, or none). */
  other: number;
}

/** Yields "750 ml" from a factor; null when the prep has no yield. */
export function scaledYield(yieldAmount: number | null, yieldUnit: string | null, factor: number): string | null {
  const q = toQuantity(yieldAmount, yieldUnit);
  return q ? formatQuantity({ ...q, value: q.value * factor }) : null;
}

export function totals(recipe: RecipeLine[]): Totals {
  const t: Totals = { ml: 0, g: 0, other: 0 };
  for (const line of recipe) {
    const q = toQuantity(line.amount, line.unit);
    if (!q || q.kind === 'count') t.other += 1;
    else t[q.kind] += q.value;
  }
  return t;
}

/** "1.15 kg", "750 ml", or both, for what one batch weighs and measures. */
export function totalsLine(t: Totals): string {
  const parts: string[] = [];
  if (t.g > 0) parts.push(formatQuantity({ kind: 'g', value: t.g, unit: 'g' }));
  if (t.ml > 0) parts.push(formatQuantity({ kind: 'ml', value: t.ml, unit: 'ml' }));
  return parts.join(' + ');
}

/**
 * Grams per 100 ml, so a weighed prep can be poured by volume and back. Only
 * when the whole recipe is weighed and the yield is a volume.
 */
export function gramsPer100ml(t: Totals, yieldAmount: number | null, yieldUnit: string | null): number | null {
  const y = toQuantity(yieldAmount, yieldUnit);
  if (!y || y.kind !== 'ml' || t.g <= 0 || t.ml > 0) return null;
  return Math.round((t.g / y.value) * 100);
}

export function scaleRecipe(recipe: RecipeLine[], factor: number): ScaledLine[] {
  return recipe.map((line) => {
    const q = toQuantity(line.amount, line.unit);
    return { ...line, scaled: q ? formatQuantity({ ...q, value: q.value * factor }) : '' };
  });
}

/** The factor that makes `target` of a prep whose one batch yields `yield`. */
export function factorForYield(yieldAmount: number | null, yieldUnit: string | null, target: Quantity | null): number | null {
  const y = toQuantity(yieldAmount, yieldUnit);
  if (!y || !target || y.kind !== target.kind || target.value <= 0) return null;
  return target.value / y.value;
}

/** The factor when you have `available` of one line ("320 g of ginger juice"). */
export function factorForLine(line: RecipeLine, available: Quantity | null): number | null {
  const q = toQuantity(line.amount, line.unit);
  if (!q || !available || q.kind !== available.kind || available.value <= 0) return null;
  return available.value / q.value;
}

/** "×2", "×1.5", "×0.43": the factor as people say it. */
export function factorLabel(factor: number): string {
  const rounded = Math.round(factor * 100) / 100;
  return `×${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0$/, '')}`;
}

/** "7 days", "36 hours", "3 weeks". */
export function shelfLifeLabel(hours: number | null): string | null {
  if (!hours) return null;
  if (hours % (24 * 7) === 0 && hours >= 24 * 14) return `${hours / (24 * 7)} weeks`;
  if (hours % 24 === 0 && hours >= 48) return `${hours / 24} days`;
  if (hours === 24) return '1 day';
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** "20 min", "2 h", "3 days", "24 h drip" (the note wins when there is one). */
export function leadTimeLabel(minutes: number | null, note: string | null): string | null {
  if (note) return note;
  if (!minutes) return null;
  if (minutes >= 2 * 24 * 60 && minutes % (24 * 60) === 0) return `${minutes / (24 * 60)} days`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}

/** "3 min", "1 h 30", "45 s" for a step's timer. */
export function timerLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  return `${m} min`;
}

/** "02:35" on a running countdown. */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** The ways a prep gets made, for the card's tags and the editor's chips. */
export const PREP_ACTIONS = [
  'Blend', 'Infuse', 'Strain', 'Clarify', 'Syrup', 'Mix', 'Sous vide', 'Centrifuge', 'Distil', 'Ferment', 'Freeze', 'Carbonate', 'Fat wash', 'Milk wash', 'Foam', 'Dehydrate',
] as const;
