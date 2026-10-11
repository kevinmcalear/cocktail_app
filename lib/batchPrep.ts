// A batch as something kept: when the bottle has to be used by, and the
// lines a prep card for it holds (boards drink-sheet-batch-venue and -home).

import type { SpecLine } from './spec';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "keeps 14 days", "keeps 4 weeks", "keeps 2 days"; null without a shelf life. */
export function keepsFor(hours: number | null | undefined): string | null {
  if (!hours || hours <= 0) return null;
  const days = Math.round(hours / 24);
  if (days < 1) return `keeps ${Math.round(hours)} hours`;
  if (days >= 14 && days % 7 === 0 && days !== 14) return `keeps ${days / 7} weeks`;
  return `keeps ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * The bottle's use-by: the shortest shelf life of what goes in it, counted
 * from today. Null when nothing in it has one (spirits keep).
 */
export function bottleExpiry(shelfHours: (number | null | undefined)[], today: Date): Date | null {
  const known = shelfHours.filter((h): h is number => !!h && h > 0);
  if (!known.length) return null;
  return new Date(today.getTime() + Math.min(...known) * 60 * 60 * 1000);
}

/** "use by Thu 22 Oct". */
export function expiryLine(date: Date | null): string | null {
  return date ? `use by ${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}` : null;
}

/** The days between two dates, for checks. */
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS);

export interface PrepLine {
  id: string | null;
  name: string;
  amount: string;
  unit: string;
}

/** The prep card's recipe: what goes in the bottle, scaled to the batch. */
export function batchPrepLines(lines: SpecLine[], bottledKeys: readonly string[], serves: number): PrepLine[] {
  return lines
    .filter((l) => bottledKeys.includes(l.key) && l.ingredient)
    .map((l) => ({ id: l.ingredientId, name: l.ingredient!, amount: l.value === null ? '' : String(Number((l.value * serves).toFixed(2))), unit: l.unit ?? '' }));
}
