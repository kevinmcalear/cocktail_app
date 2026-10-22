// A drink read by Bring in, as the add-drink wizard's draft: what the recipe
// check saves (through the wizard's own save, hooks/useCreateDrink) and what
// "Edit all" opens. Pure.

import { prepRatio } from '@/lib/bringIn';
import { ingredientState, plainKind, type MatchData } from '@/lib/bringInMatch';
import { convertPour, EMPTY_DRAFT, newLine, type WizardDraft, type WizardLine, type WizardPick } from '@/lib/drinkWizard';
import { normName } from '@/lib/paste';
import { startPrep, type PrepDraft } from '@/lib/prepKinds';
import { versionName } from '@/lib/sameName';
import type { RecipeReadLine, RecipeReading } from '@/supabase/functions/_shared/anythingRead';

/** What the person decided on a line: a pick, or "make it new" instead of the match. */
export type LineChoice = { pick: string } | { fresh: true };

export interface RecipeChoices {
  name: string;
  madeBy: string;
  source: string;
  notes: string;
  /** By line index. */
  lines: Record<number, LineChoice>;
  /** The bar already has a drink by this name, with a different spec: what to do with the sheet's. */
  same?: SheetPick | null;
}

/**
 * Update it (the bar's drink takes the sheet's spec), Keep both (the sheet's
 * is saved as a version of it, with a word in brackets) or Skip (board
 * dup-drink-warning). Plain JSON: a review keeps it on the device.
 */
export interface SheetPick {
  /** The bar's drink, its name and whose it is. */
  id: string;
  name: string;
  bar: string;
  as: 'update' | 'keep' | 'skip';
  word?: string;
  /** What Keep both links to: the classic the bar's drink is a version of, else the bar's drink. */
  riff: WizardPick;
}

export const startChoices = (recipe: RecipeReading): RecipeChoices => ({ name: recipe.name, madeBy: '', source: recipe.by ?? '', notes: recipe.notes ?? '', lines: {} });

export interface NamedRow {
  id: string;
  name: string;
}

/** "Honey syrup 2:1" as a new prep with its recipe read: 2 parts honey, 1 part water. Null without a ratio. */
export function prepFromRatio(name: string): PrepDraft | null {
  const ratio = name.match(/^(.+?)\s+syrup\b.*?\b(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/i);
  if (!ratio || !prepRatio(name)) return null;
  const base = startPrep('syrup', name);
  const flavour = ratio[1].trim();
  const [first, water] = base.lines;
  return { ...base, lines: [{ ...first, name: flavour.charAt(0).toUpperCase() + flavour.slice(1), parts: Number(ratio[2]) }, { ...water, parts: Number(ratio[3]) }] };
}

/** What a line saves as: the bottle it matched or was picked, the plain kind when nobody picked, else a new one. */
export function linePick(line: RecipeReadLine, data: Pick<MatchData, 'catalog' | 'aliases' | 'venueId'>, choice: LineChoice | undefined): WizardPick & { prep?: PrepDraft } {
  const read = { id: null, name: line.ingredient };
  if (choice && 'fresh' in choice) return { ...read, ...(prepFromRatio(line.ingredient) ? { prep: prepFromRatio(line.ingredient)! } : {}) };
  const state = ingredientState(line.ingredient, data, choice?.pick);
  if (state.state === 'have') return { id: state.item.id, name: state.item.name };
  if (state.state === 'pick') {
    const kind = plainKind(line.ingredient, state.items, data);
    return kind ? { id: kind.id, name: kind.name } : read;
  }
  const prep = prepFromRatio(line.ingredient);
  return prep ? { ...read, prep } : read;
}

const GARNISH_UNIT = /\b(peel|twist|wheel|slice|wedge|sprig|leaf|zest)s?\b/i;

/** A row from a list, by name (any case), as a pick; null when there's none (it goes in the notes instead). */
function known(name: string | null, rows: NamedRow[]): WizardPick | null {
  if (!name) return null;
  const hit = rows.find((r) => normName(r.name) === normName(name.replace(/\.$/, '')));
  return hit ? { id: hit.id, name: hit.name } : null;
}

/**
 * The recipe as a wizard draft. Pours show in your usual unit; a method,
 * glass or ice the app doesn't know goes in the notes rather than becoming a
 * new one; who made it and where it's from are noted.
 */
export function recipeDraft(
  recipe: RecipeReading,
  choices: RecipeChoices,
  data: Pick<MatchData, 'catalog' | 'aliases' | 'venueId'>,
  lists: { methods: NamedRow[]; glasses: NamedRow[]; ice: NamedRow[] },
  usual: string,
): WizardDraft {
  const lines: WizardLine[] = recipe.lines.map((line, i) => {
    const pick = linePick(line, data, choices.lines[i]);
    const pour = line.unit === 'top' ? { amount: '', unit: 'top' } : convertPour(line.amount, line.unit ?? usual, usual);
    return { ...newLine({ id: pick.id, name: pick.name }, pour.unit, pour.amount), ...(pick.prep ? { prep: pick.prep } : {}) };
  });
  const method = known(recipe.method, lists.methods);
  const glass = known(recipe.glass, lists.glasses);
  const ice = known(recipe.ice, lists.ice);
  const garnishes = recipe.garnish ? [newLine({ id: null, name: recipe.garnish }, recipe.garnish.match(GARNISH_UNIT)?.[1].toLowerCase() ?? 'each', '1')] : [];
  const notes = [
    choices.madeBy.trim() ? `By ${choices.madeBy.trim()}` : null,
    choices.source.trim() ? `From ${choices.source.trim()}` : null,
    !method && recipe.method ? recipe.method : null,
    !glass && recipe.glass ? `Glass: ${recipe.glass}` : null,
    !ice && recipe.ice ? `Ice: ${recipe.ice}` : null,
    choices.notes.trim() || null,
  ].filter(Boolean);
  const same = choices.same?.as === 'keep' ? choices.same : null;
  return {
    ...EMPTY_DRAFT,
    name: same ? versionName(same.name, same.word) : choices.name.trim() || recipe.name,
    lines,
    methods: method ? [method] : [],
    glass,
    ice,
    garnishes,
    // Someone else made it, so it isn't credited to you.
    creator: choices.madeBy.trim() || choices.source.trim() ? 'nobody' : null,
    notes: notes.join('\n'),
    ...(same ? { riffOf: same.riff, sameAs: { id: same.id, name: same.name, bar: same.bar, as: 'version' as const, word: same.word } } : {}),
  };
}

/** "Pick the pear liqueur, or it saves as “Pear liqueur”": the first open pick, said as the footer says it. */
export function openPickLine(recipe: RecipeReading, choices: RecipeChoices, data: Pick<MatchData, 'catalog' | 'aliases' | 'venueId'>): string | null {
  for (const [i, line] of recipe.lines.entries()) {
    const choice = choices.lines[i];
    if (choice && 'fresh' in choice) continue;
    const state = ingredientState(line.ingredient, data, choice?.pick);
    if (state.state !== 'pick') continue;
    const kind = plainKind(line.ingredient, state.items, data);
    return `Pick the ${line.ingredient.toLowerCase()}, or it saves as “${kind?.name ?? line.ingredient}”`;
  }
  return null;
}

/**
 * A new drink read off a menu: its name and the ingredients printed under it
 * (no amounts on a menu). `picks`: ingredient index → the bottle picked.
 */
export function menuDrinkDraft(name: string, ingredients: string[], data: Pick<MatchData, 'catalog' | 'aliases' | 'venueId'>, picks: Record<number, string> = {}): WizardDraft {
  const lines = ingredients.map((ingredient, i) => {
    const pick = linePick({ amount: null, unit: null, ingredient, unsure: false }, data, picks[i] ? { pick: picks[i] } : undefined);
    return newLine({ id: pick.id, name: pick.name }, '', '');
  });
  return { ...EMPTY_DRAFT, name, lines };
}
