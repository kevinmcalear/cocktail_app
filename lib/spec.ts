/**
 * A cocktail's spec as the redesigned drink page shows it, from the
 * role-masked recipe rows (app_recipe_presentation). The server blanks what a
 * role can't see; this works out what's showing and what's locked, and at
 * which level it opens.
 */

import { density, toMl } from '@/lib/drinkMath';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
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
  /** In the batch (false) or added at the station (true); null when undecided or masked with the amounts. */
  at_service?: boolean | null;
  /** The ingredient this role may see (brand or generic), embedded by the query; masked to null otherwise. */
  display_ingredient?: PresentationIngredient | null;
}

/** The ingredient a line shows: its pictures as item_images, or a public view's image_url. */
interface PresentationIngredient {
  id?: string;
  name?: string;
  abv?: number | null;
  density_g_ml?: number | null;
  image_url?: string | null;
  item_images?: ItemImageLink[] | null;
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
  /** Amount in ml, for the ratio bar and batch bottle; weights convert by density. Null when it can't be converted. */
  ml: number | null;
  /** The raw number and unit (for scaling a batch); null when locked or missing. */
  value: number | null;
  unit: string | null;
  /** The bar's decision: added at the station (true) or in the batch (false). Null: not decided, or hidden with the amounts. */
  atService: boolean | null;
  /** The ingredient's ABV, for ethanol; null when not on file or masked. */
  abv: number | null;
  /** The ingredient's own density, when set. */
  density: number | null;
  /** The ingredient's picture; null when it has none or its name is locked. */
  imageUrl: string | null;
}

// Grams convert to ml through the ingredient's density (lib/drinkMath.ts).
export { density as gramsPerMl } from '@/lib/drinkMath';

export function specLines(recipes: PresentationRecipe[] | null | undefined): SpecLine[] {
  return sortRecipesByOrder([...(recipes ?? [])]).map((r, i) => {
    const resolved = resolvePresentationIngredient(r) as PresentationIngredient | null;
    const n = r.amount === null || r.amount === undefined || r.amount === '' ? null : Number(r.amount);
    const amount = n === null || Number.isNaN(n) ? null : [String(r.amount), r.unit].filter(Boolean).join(' ');
    return {
      key: r.id ?? `${i}`,
      amount,
      ingredient: resolved?.name ?? null,
      ingredientId: resolved?.id ?? r.display_ingredient_id ?? null,
      note: r.preparation_notes?.trim() || null,
      optional: !!r.is_optional,
      ml: n === null || Number.isNaN(n) ? null : toMl(n, r.unit, density(resolved?.name, resolved?.abv, resolved?.density_g_ml)),
      value: n === null || Number.isNaN(n) ? null : n,
      unit: r.unit?.trim() || null,
      atService: typeof r.at_service === 'boolean' ? r.at_service : null,
      abv: typeof resolved?.abv === 'number' ? resolved.abv : null,
      density: typeof resolved?.density_g_ml === 'number' ? resolved.density_g_ml : null,
      imageUrl: resolved?.image_url ?? heroPicture(resolved?.item_images)?.url ?? null,
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
