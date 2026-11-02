/**
 * A cocktail's spec as the redesigned drink page shows it, from the
 * role-masked recipe rows (app_recipe_presentation). The server blanks what a
 * role can't see; this works out what's showing and what's locked, and at
 * which level it opens.
 */

import { density, toMl } from '@/lib/drinkMath';
import { type ItemImageLink } from '@/lib/itemImages';
import { resolvePresentationIngredient, sortRecipesByOrder } from '@/lib/recipeUtils';
import { amountText, unitOnlyText } from '@/lib/units';

export interface PresentationRecipe {
  id?: string;
  sort_order?: number | null;
  created_at?: string;
  amount?: number | string | null;
  unit?: string | null;
  preparation_notes?: string | null;
  is_optional?: boolean | null;
  /** Floated on top (recipes.is_float). */
  is_float?: boolean | null;
  /** A garnish, said even where the unit is masked (20261206010000; absent before it). */
  is_garnish?: boolean | null;
  display_ingredient_id?: string | null;
  ingredient_item_id?: string | null;
  parent_ingredient_id?: string | null;
  /** In the batch (false) or added at the station (true); null when undecided or masked with the amounts. */
  at_service?: boolean | null;
  /** A drink made in parts: which part the line is in (recipes.part, from 1). */
  part?: number | null;
  /** The ingredient this role may see (brand or generic), embedded by the query; masked to null otherwise. */
  display_ingredient?: PresentationIngredient | null;
}

/** The ingredient a line shows: its pictures as item_images, or a public view's image_url. */
interface PresentationIngredient {
  id?: string;
  name?: string;
  abv?: number | null;
  density_g_ml?: number | null;
  /** 'prep' for a house-made one (a syrup, a shrub, a batch). */
  ingredient_role?: string | null;
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
  /** Floated on top: the drink page tags it "Float" (Eddie tf-060). */
  float: boolean;
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
  /** Made in house from its own recipe. */
  houseMade?: boolean;
  /** A drink made in parts: which part the line is in (recipes.part, from 1). */
  part?: number | null;
  /** A garnish, as the server says where the unit is masked (a guest's or the floor's names); unset, the unit decides (lib/batch isGarnishLine). */
  garnish?: boolean;
}

// Grams convert to ml through the ingredient's density (lib/drinkMath.ts).
export { density as gramsPerMl } from '@/lib/drinkMath';

export function specLines(recipes: PresentationRecipe[] | null | undefined): SpecLine[] {
  return sortRecipesByOrder([...(recipes ?? [])]).map((r, i) => {
    const resolved = resolvePresentationIngredient(r) as PresentationIngredient | null;
    const n = r.amount === null || r.amount === undefined || r.amount === '' ? null : Number(r.amount);
    const amount = n === null || Number.isNaN(n) ? unitOnlyText(r.unit) : amountText(String(r.amount), r.unit);
    return {
      key: r.id ?? `${i}`,
      amount,
      ingredient: resolved?.name ?? null,
      ingredientId: resolved?.id ?? r.display_ingredient_id ?? null,
      note: r.preparation_notes?.trim() || null,
      optional: !!r.is_optional,
      float: !!r.is_float,
      ml: n === null || Number.isNaN(n) ? null : toMl(n, r.unit, density(resolved?.name, resolved?.abv, resolved?.density_g_ml)),
      value: n === null || Number.isNaN(n) ? null : n,
      unit: r.unit?.trim() || null,
      atService: typeof r.at_service === 'boolean' ? r.at_service : null,
      abv: typeof resolved?.abv === 'number' ? resolved.abv : null,
      density: typeof resolved?.density_g_ml === 'number' ? resolved.density_g_ml : null,
      houseMade: resolved?.ingredient_role === 'prep',
      part: r.part ?? null,
      ...(typeof r.is_garnish === 'boolean' ? { garnish: r.is_garnish } : {}),
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
  /** The bar hides this drink's spec: only those who edit it see brands, amounts and prep notes. */
  hidden?: boolean;
}

/** The lowest base level that edits drinks by default (Drink Creator): who still sees a hidden spec. */
const EDITS_DRINKS = 35;

/**
 * Where each part opens, from the venue's built-in roles' permissions (with
 * its changes, as get_venue_role_matrix returns them) and the drink's hide
 * (20261204300000): names with talking_points or specs, brands and amounts
 * with specs, prep notes with house_made. A part no built-in role opens reads 41.
 */
export function specLevelsFrom(rows: readonly { role_id: string | null; base_level: number; capabilities: readonly string[] }[], hidden = false): SpecLevels {
  const lowest = (...caps: string[]) =>
    Math.min(41, ...rows.filter((r) => r.role_id === null && caps.some((c) => r.capabilities.includes(c))).map((r) => r.base_level));
  const specs = lowest('specs');
  const prep = lowest('house_made');
  return {
    generic: lowest('talking_points', 'specs'),
    brand: hidden ? Math.max(specs, EDITS_DRINKS) : specs,
    measurement: hidden ? Math.max(specs, EDITS_DRINKS) : specs,
    prep: hidden ? Math.max(prep, EDITS_DRINKS) : prep,
    hidden,
  };
}

export interface SpecAccess {
  names: boolean;
  amounts: boolean;
  prep: boolean;
}

/** A role's grant or revoke of the specs permission at a venue (Roles and access). */
export interface SpecsMove {
  granted: boolean;
  revoked: boolean;
}

export const NO_SPECS_MOVE: SpecsMove = { granted: false, revoked: false };

/**
 * What this role can see, as app_recipe_presentation decides it: where the
 * venue's permissions open each part (specLevelsFrom), moved by the person's
 * own role's specs grant (amounts and names) or revoke (amounts). Personal
 * drinks (no venue) show everything.
 */
export function specAccess(role: number, levels: SpecLevels | null, isVenueDrink: boolean, specs: SpecsMove = NO_SPECS_MOVE): SpecAccess {
  if (!isVenueDrink || !levels) return { names: true, amounts: true, prep: true };
  return {
    names: role >= Math.min(levels.generic, levels.brand) || specs.granted,
    amounts: (role >= levels.measurement || specs.granted) && !specs.revoked,
    prep: role >= levels.prep,
  };
}
