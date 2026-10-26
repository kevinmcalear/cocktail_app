// A big recipe import as a review you can finish later (board eddie-oct22-wave2,
// Fix 11): each drink is approved (saved to the Library at once) or skipped,
// and what's left waits on this device. Pure, so it can be checked
// (lib/importReview.check.ts); the store is store/useBringIn.ts.
//
// ponytail: kept on this device only (Kevin, 22 Oct). Starting on a laptop and
// finishing on a phone would need the waiting drinks in a small table.

import type { BatchSummary } from '@/lib/bringInBatch';
import type { MadeBatches, RecipeChoices } from '@/lib/bringInDraft';
import { dayWord } from '@/lib/featureNews';
import type { ReadFile } from '@/lib/readAnything';
import { drinkRecipe } from '@/lib/readBatch';
import { sameName } from '@/lib/sameName';
import type { RecipeReading } from '@/supabase/functions/_shared/anythingRead';

/** Approved is saved; saving is on its way; skipped is left out (and can still be approved). */
export type DrinkMark = 'approved' | 'saving' | 'skipped' | null;

/** One import being reviewed. Plain JSON: it's persisted as is. */
export interface ImportReview {
  id: string;
  /** Whose it is and where it comes into (null is your home bar): only they see it. */
  userId: string;
  barId: string | null;
  /** The file's name ("Little Rye spec book.pdf"), or what it was ("Pasted text"). */
  name: string;
  /** The words each save records its batch with ("a spec PDF"). */
  source: string;
  startedAt: string;
  updatedAt: string;
  recipes: RecipeReading[];
  /** The pages, for the bit of the file each drink came from. A page that can't outlive the session has no uri. */
  files: ReadFile[];
  choices: RecipeChoices[];
  marks: DrinkMark[];
  drinkIds: (string | null)[];
  /** Was saving when the app stopped: kept as approved, never saved again, and said so. */
  unsure: number[];
  at: number;
  /** What the saves made, added up, for Brought in at the end. */
  summary: BatchSummary;
  warnings: string[];
  /** Batches read from the file that a drink here already saved, by their key: a later drink pouring one uses it (lib/readBatch). */
  batches?: MadeBatches;
}

export interface Tally {
  total: number;
  checked: number;
  approved: number;
  skipped: number;
}

/** A page's uri that won't be there after a reload (a web blob, inline data) is dropped, not stored. */
export function keepFiles(files: ReadFile[]): ReadFile[] {
  return files.map((f) => (/^(blob|data):/i.test(f.uri) ? { ...f, uri: '' } : f));
}

export function startReview(input: { id: string; userId: string; barId: string | null; name: string; source: string; recipes: RecipeReading[]; files: ReadFile[]; choices: RecipeChoices[]; summary: BatchSummary; now: string }): ImportReview {
  const n = input.recipes.length;
  return {
    id: input.id,
    userId: input.userId,
    barId: input.barId,
    name: input.name,
    source: input.source,
    startedAt: input.now,
    updatedAt: input.now,
    recipes: input.recipes,
    files: keepFiles(input.files),
    choices: input.choices,
    marks: Array.from({ length: n }, () => null),
    drinkIds: Array.from({ length: n }, () => null),
    unsure: [],
    at: 0,
    summary: input.summary,
    warnings: [],
  };
}

/** Saving counts as approved: it was, and it can't be undone from here. */
export function tally(review: ImportReview): Tally {
  const approved = review.marks.filter((m) => m === 'approved' || m === 'saving').length;
  const skipped = review.marks.filter((m) => m === 'skipped').length;
  return { total: review.marks.length, checked: approved + skipped, approved, skipped };
}

/** "18 of 46 checked · 15 approved · 3 skipped". */
export const tallyLine = (t: Tally) => `${t.checked} of ${t.total} checked · ${t.approved} approved · ${t.skipped} skipped`;

/** The next drink nobody has checked, after `from` and then from the top; null when none is left. */
export function nextOpen(marks: DrinkMark[], from: number): number | null {
  for (let i = from + 1; i < marks.length; i++) if (marks[i] === null) return i;
  for (let i = 0; i <= Math.min(from, marks.length - 1); i++) if (marks[i] === null) return i;
  return null;
}

/** Approve saves it, so only a drink not saved (or on its way) can be approved or skipped. */
export const canCheck = (review: ImportReview, i: number) => review.marks[i] === null || review.marks[i] === 'skipped';

/** Every drink checked and nothing still saving. */
export const isFinished = (review: ImportReview) => review.marks.every((m) => m === 'approved' || m === 'skipped');

export function setMark(review: ImportReview, i: number, mark: DrinkMark, now: string, drinkId: string | null = null): ImportReview {
  if (i < 0 || i >= review.marks.length) return review;
  return {
    ...review,
    updatedAt: now,
    marks: review.marks.map((m, k) => (k === i ? mark : m)),
    drinkIds: review.drinkIds.map((d, k) => (k === i ? drinkId : d)),
  };
}

/** Two saves' summaries as one. */
export function addSummary(a: BatchSummary, b: BatchSummary): BatchSummary {
  return {
    kind: a.kind,
    drinksNew: a.drinksNew + b.drinksNew,
    drinksHad: a.drinksHad + b.drinksHad,
    preps: [...a.preps, ...b.preps],
    ingredients: [...a.ingredients, ...b.ingredients],
    bottles: a.bottles + b.bottles,
    noAmounts: a.noAmounts + b.noAmounts,
    prepsNoRecipe: [...a.prepsNoRecipe, ...b.prepsNoRecipe],
  };
}

/** A save that went through: approved, with its drink and what it made. */
export function approved(review: ImportReview, i: number, saved: { drinkId: string | null; summary: BatchSummary; warnings: string[]; batches?: MadeBatches }, now: string): ImportReview {
  const next = setMark(review, i, 'approved', now, saved.drinkId);
  const batches = saved.batches && Object.keys(saved.batches).length ? { batches: { ...review.batches, ...saved.batches } } : {};
  return { ...next, summary: addSummary(review.summary, saved.summary), warnings: [...review.warnings, ...saved.warnings], ...batches };
}

/**
 * Read back after the app was closed: a drink that was saving when it
 * stopped may well be in the Library, so it's kept as approved and never
 * saved again (a second copy is worse), and marked unsure so the screen can
 * say to check.
 */
export function settle(review: ImportReview): ImportReview {
  if (!review.marks.includes('saving')) return review;
  const unsure = review.marks.flatMap((m, i) => (m === 'saving' ? [i] : []));
  return { ...review, marks: review.marks.map((m) => (m === 'saving' ? 'approved' : m)), unsure: [...new Set([...review.unsure, ...unsure])] };
}

/** The newest review this person has waiting for this place, if any. */
export function waitingFor(reviews: Record<string, ImportReview>, userId: string | null, barId: string | null): ImportReview | null {
  if (!userId) return null;
  const mine = Object.values(reviews).filter((r) => r.userId === userId && r.barId === barId && !isFinished(r));
  return mine.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

/** "Little Rye spec book.pdf" is "Little Rye spec book" on the card. */
export const fileTitle = (name: string) => name.replace(/\.[a-z0-9]{2,4}$/i, '') || name;

/** "Today", "Yesterday" or "3 Oct". */
export function whenWords(iso: string, now: number): string {
  const word = dayWord(iso, now);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A drink taken out (it wasn't a drink, board w2-import-review E20), kept so Undo puts it back where it was. */
export interface TakenOut {
  i: number;
  recipe: RecipeReading;
  choices: RecipeChoices;
  mark: DrinkMark;
  unsure: boolean;
}

/**
 * Takes drink `i` out of the review: gone from the list and the count. Only
 * one not saved can go (a saved drink is in the Library). The screen stays
 * on the drink that moves into its place. Null when it can't go.
 */
export function takeOut(review: ImportReview, i: number, now: string): { review: ImportReview; gone: TakenOut } | null {
  if (!canCheck(review, i)) return null;
  const drop = <T>(list: T[]) => list.filter((_, k) => k !== i);
  const left = review.recipes.length - 1;
  const at = review.at > i ? review.at - 1 : Math.min(review.at, Math.max(left - 1, 0));
  return {
    review: {
      ...review,
      updatedAt: now,
      recipes: drop(review.recipes),
      choices: drop(review.choices),
      marks: drop(review.marks),
      drinkIds: drop(review.drinkIds),
      unsure: review.unsure.filter((u) => u !== i).map((u) => (u > i ? u - 1 : u)),
      at,
    },
    gone: { i, recipe: review.recipes[i], choices: review.choices[i], mark: review.marks[i], unsure: review.unsure.includes(i) },
  };
}

/** Undo: the drink back where it was, and on screen. */
export function putBack(review: ImportReview, gone: TakenOut, now: string): ImportReview {
  const i = Math.min(gone.i, review.recipes.length);
  const add = <T>(list: T[], value: T) => [...list.slice(0, i), value, ...list.slice(i)];
  const unsure = review.unsure.map((u) => (u >= i ? u + 1 : u));
  return {
    ...review,
    updatedAt: now,
    recipes: add(review.recipes, gone.recipe),
    choices: add(review.choices, gone.choices),
    marks: add(review.marks, gone.mark),
    drinkIds: add(review.drinkIds, null),
    unsure: gone.unsure ? [...unsure, i] : unsure,
    at: i,
  };
}

/**
 * Kept as house-made: the drinks still to check that call for it match it
 * again. A line someone set to "make it new" goes back to matching, so it
 * finds the house-made once the catalog has it; picks stay as picked.
 */
export function rematch(review: ImportReview, name: string): ImportReview {
  const choices = review.choices.map((c, k) => {
    if (!canCheck(review, k)) return c;
    // Choices follow the lines as shown (a batch kept as separate lines included).
    const shown = review.recipes[k] ? drinkRecipe(review.recipes[k], c).lines : [];
    const lines = Object.fromEntries(Object.entries(c.lines).filter(([at, choice]) => !('fresh' in choice && sameName(shown[Number(at)]?.ingredient ?? '', name))));
    return Object.keys(lines).length === Object.keys(c.lines).length ? c : { ...c, lines };
  });
  return { ...review, choices };
}
