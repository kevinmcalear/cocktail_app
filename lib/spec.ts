/**
 * A cocktail's spec as the redesigned drink page shows it, from the
 * role-masked recipe rows (app_recipe_presentation). The server blanks what a
 * role can't see; this works out what's showing and what's locked, and at
 * which level it opens.
 */

import { resolvePresentationIngredient, sortRecipesByOrder } from '@/lib/recipeUtils';

export interface PresentationRecipe {
  id?: string;
  sort_order?: number | null;
  created_at?: string;
  amount?: number | string | null;
  unit?: string | null;
  preparation_notes?: string | null;
  is_optional?: boolean | null;
  display_ingredient_id?: string | null;
  ingredient_item_id?: string | null;
  parent_ingredient_id?: string | null;
  /** The ingredient this role may see (brand or generic), embedded by the query; masked to null otherwise. */
  display_ingredient?: { id?: string; name?: string } | null;
}

export interface SpecLine {
  key: string;
  /** "22.5 ml", or null when there's no amount or it's locked. */
  amount: string | null;
  /** Null when the name is locked for this role. */
  ingredient: string | null;
  ingredientId: string | null;
  note: string | null;
  optional: boolean;
  /** Amount in ml, for the ratio bar; null when it can't be converted. */
  ml: number | null;
}

// ponytail: approximate volumes for proportions only, never shown as numbers.
const ML_PER_UNIT: Record<string, number> = {
  ml: 1,
  cl: 10,
  oz: 29.57,
  dash: 0.8,
  dashes: 0.8,
  barspoon: 5,
  tsp: 5,
  tbsp: 15,
};

function toMl(amount: number, unit: string | null | undefined): number | null {
  const per = unit ? ML_PER_UNIT[unit.trim().toLowerCase()] : undefined;
  return per ? amount * per : null;
}

export function specLines(recipes: PresentationRecipe[] | null | undefined): SpecLine[] {
  return sortRecipesByOrder([...(recipes ?? [])]).map((r, i) => {
    const resolved = resolvePresentationIngredient(r) as { id?: string; name?: string } | null;
    const n = r.amount === null || r.amount === undefined || r.amount === '' ? null : Number(r.amount);
    const amount = n === null || Number.isNaN(n) ? null : [String(r.amount), r.unit].filter(Boolean).join(' ');
    return {
      key: r.id ?? `${i}`,
      amount,
      ingredient: resolved?.name ?? null,
      ingredientId: resolved?.id ?? r.display_ingredient_id ?? null,
      note: r.preparation_notes?.trim() || null,
      optional: !!r.is_optional,
      ml: n === null || Number.isNaN(n) ? null : toMl(n, r.unit),
    };
  });
}

/** Proportions for the ratio bar: only when at least two lines convert to ml. */
export function ratio(lines: SpecLine[]): { key: string; share: number }[] | null {
  const measured = lines.filter((l) => l.ml !== null && l.ml > 0) as (SpecLine & { ml: number })[];
  if (measured.length < 2) return null;
  const total = measured.reduce((sum, l) => sum + l.ml, 0);
  return measured.map((l) => ({ key: l.key, share: l.ml / total }));
}

/** The levels (10 to 40) at which each part of a venue drink's spec opens. */
export interface SpecLevels {
  generic: number;
  brand: number;
  measurement: number;
  prep: number;
}

export interface SpecAccess {
  names: boolean;
  amounts: boolean;
  prep: boolean;
}

/** What this role can see. Personal drinks (no venue) show everything. */
export function specAccess(role: number, levels: SpecLevels | null, isVenueDrink: boolean): SpecAccess {
  if (!isVenueDrink || !levels) return { names: true, amounts: true, prep: true };
  return {
    names: role >= Math.min(levels.generic, levels.brand),
    amounts: role >= levels.measurement,
    prep: role >= levels.prep,
  };
}
