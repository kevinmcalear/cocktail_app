import { emptySummary, type BatchSummary } from './bringInBatch';

/** Where one drink of a big import stands. Edited: handed to the full editor, which saves it. */
export type DrinkMark = 'waiting' | 'approved' | 'skipped' | 'edited';

/** What approved drinks have made so far, kept until the import is recorded as one batch. Plain JSON. */
export interface MadeSoFar {
  itemIds: string[];
  drinkIds: string[];
  summary: BatchSummary;
  warnings: string[];
}

export const nothingMade = (): MadeSoFar => ({ itemIds: [], drinkIds: [], summary: emptySummary('recipes'), warnings: [] });

/** Two lots of made things as one. */
export function addMade(a: MadeSoFar, b: MadeSoFar): MadeSoFar {
  const s = a.summary;
  const t = b.summary;
  return {
    itemIds: [...a.itemIds, ...b.itemIds],
    drinkIds: [...a.drinkIds, ...b.drinkIds],
    warnings: [...a.warnings, ...b.warnings],
    summary: {
      ...s,
      drinksNew: s.drinksNew + t.drinksNew,
      drinksHad: s.drinksHad + t.drinksHad,
      preps: [...s.preps, ...t.preps],
      ingredients: [...s.ingredients, ...t.ingredients],
      bottles: s.bottles + t.bottles,
      noAmounts: s.noAmounts + t.noAmounts,
      prepsNoRecipe: [...s.prepsNoRecipe, ...t.prepsNoRecipe],
    },
  };
}

export interface ReviewCount {
  total: number;
  checked: number;
  approved: number;
  skipped: number;
  /** 0 to 100, for the bar. */
  percent: number;
}

export function reviewCount(marks: DrinkMark[]): ReviewCount {
  const total = marks.length;
  const approved = marks.filter((m) => m === 'approved' || m === 'edited').length;
  const skipped = marks.filter((m) => m === 'skipped').length;
  const checked = approved + skipped;
  return { total, checked, approved, skipped, percent: total ? Math.round((checked / total) * 100) : 0 };
}

/** "18 of 46 checked · 15 approved · 3 skipped"; the card's "18 of 46 checked"; the phone's short "18 of 46". */
export function countWords(c: ReviewCount, form: 'full' | 'checked' | 'short' = 'full'): string {
  if (form === 'short') return `${c.checked} of ${c.total}`;
  if (form === 'checked') return `${c.checked} of ${c.total} checked`;
  return [`${c.checked} of ${c.total} checked`, c.approved ? `${c.approved} approved` : null, c.skipped ? `${c.skipped} skipped` : null].filter(Boolean).join(' · ');
}

/** The next drink still waiting after `from`, going round to the start; null when every drink is checked. */
export function nextWaiting(marks: DrinkMark[], from: number): number | null {
  for (let step = 1; step <= marks.length; step++) {
    const i = (from + step) % marks.length;
    if (marks[i] === 'waiting') return i;
  }
  return null;
}

/** "Today", "Yesterday", "3 days ago", for the carry-on card. */
export function whenWords(iso: string, now = new Date()): string {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((day(now) - day(new Date(iso))) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/** A file's name without its ending, for the card: "Little Rye spec book.pdf" reads "Little Rye spec book". */
export const plainTitle = (name: string) => name.replace(/\.(pdf|jpe?g|png|heic|webp|txt|csv|md)$/i, '');
