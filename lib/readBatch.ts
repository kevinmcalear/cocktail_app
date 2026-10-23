/**
 * A batch read by Bring in (board eddie-oct22-wave2, Fix 10): a spec sheet's
 * "Batch recipe (750 ml)" column, or what a "60 ml batch" line is made of.
 * The drink keeps one line that pours it, made into the same batch line the
 * add-drink wizard makes by dropping lines together (lib/batchLines), so it
 * saves as a house prep of the kind Batch. "Keep as separate lines" puts the
 * bottle's lines in the drink instead, as one drink pours them. Pure.
 */
import { pourMl } from './batchLines';
import type { LineChoice, RecipeChoices } from './bringInDraft';
import type { ReadBatch, RecipeReading, RecipeReadLine } from '@/supabase/functions/_shared/anythingRead';

/** A read line's pour in ml (2 oz is 60), or null for a count, a top or no amount. */
export const readMl = (l: RecipeReadLine): number | null => (l.amount === null ? null : pourMl({ amount: String(l.amount), unit: l.unit ?? '' }));

/** What one bottle holds, in ml: its pours added up (450 ml mezcal and 300 ml Cynar is 750). */
export function bottleMl(batch: ReadBatch): number {
  return Math.round(batch.lines.reduce((s, l) => s + (readMl(l) ?? 0), 0) * 10) / 10;
}

/** The drink line that pours the batch, or -1 when there's none to use (an older reader, or nothing measured). */
export function batchAt(recipe: RecipeReading): number {
  if (!recipe.batch || bottleMl(recipe.batch) <= 0) return -1;
  const at = recipe.lines.findIndex((l) => l.batch);
  return at >= 0 && (readMl(recipe.lines[at]) ?? 0) > 0 ? at : -1;
}

/** The batch as this drink pours it: shown as one line, unless it's kept as separate lines. -1 when there's no batch line. */
export const batchShownAt = (recipe: RecipeReading, choices: Pick<RecipeChoices, 'batch'>): number => (choices.batch?.separate ? -1 : batchAt(recipe));

/**
 * The bottle's lines as one drink pours them, in the units written: 450 ml
 * mezcal and 300 ml Cynar in a 750 ml bottle, at 60 ml a drink, are 36 and
 * 24 ml. Counts (dashes) scale the same way; a line with no amount stays so.
 */
export function perDrinkLines(recipe: RecipeReading): RecipeReadLine[] {
  const at = batchAt(recipe);
  if (at < 0) return [];
  const scale = readMl(recipe.lines[at])! / bottleMl(recipe.batch!);
  return recipe.batch!.lines.map((l) => ({ ...l, amount: l.amount === null ? null : Math.round(l.amount * scale * 100) / 100 }));
}

/** The recipe as this drink is checked: as read, or with the bottle's lines in place of the batch line (Keep as separate lines). */
export function drinkRecipe(recipe: RecipeReading, choices: Pick<RecipeChoices, 'batch'>): RecipeReading {
  const at = batchAt(recipe);
  if (at < 0 || !choices.batch?.separate) return recipe;
  return { ...recipe, batch: null, lines: [...recipe.lines.slice(0, at), ...perDrinkLines(recipe), ...recipe.lines.slice(at + 1)] };
}

/**
 * Keep as separate lines (or back to the batch): the choices made on the
 * other lines move with them, and the lines coming in start unpicked.
 */
export function keepSeparate(recipe: RecipeReading, choices: RecipeChoices, separate: boolean): RecipeChoices {
  const at = batchAt(recipe);
  if (at < 0 || !!choices.batch?.separate === separate) return choices;
  const n = recipe.batch!.lines.length;
  const lines: Record<number, LineChoice> = {};
  for (const [k, choice] of Object.entries(choices.lines)) {
    const i = Number(k);
    if (i < at) lines[i] = choice;
    else if (separate && i > at) lines[i + n - 1] = choice;
    else if (!separate && i >= at + n) lines[i - n + 1] = choice;
  }
  return { ...choices, lines, batch: { ...choices.batch, separate } };
}
