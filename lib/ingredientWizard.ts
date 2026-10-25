/**
 * A new ingredient's fields and the guesses that fill them: what it's a kind
 * of, how strong. A bottle you buy is added with the short form
 * (components/screens/addIngredient/AddBottle); anything with a recipe with
 * the house recipe steps. Saving: hooks/useCreateIngredient.ts.
 */
import { ruleFor } from '../supabase/functions/_shared/flavor';

import type { DraftPhoto } from './beerWineWizard';
import type { WizardLine, WizardPick } from './drinkWizard';
import { ingredientKey } from './ingredientNames';

/** What it is: items.ingredient_role, 'other' saved as not said. */
export type IngredientRole = 'product' | 'prep' | 'other';

export interface IngredientDraft {
  name: string;
  role: IngredientRole | null;
  /** What it's a kind of: an existing ingredient ("Gin" for "Tanqueray"). */
  generic: WizardPick | null;
  maker: string;
  /** ABV in percent, as typed. */
  abv: string;
  /** A house prep's recipe, in any amounts. */
  lines: WizardLine[];
  description: string;
  /** The label photo read for the name; not saved (ingredients are drawn). */
  photo: DraftPhoto | null;
}

export const EMPTY_INGREDIENT: IngredientDraft = { name: '', role: null, generic: null, maker: '', abv: '', lines: [], description: '', photo: null };

const BROAD = /^(syrup|juice|liqueur|bitters|cordial|water|soda|cream|wine|spirit|sugar|tea|milk)$/;

/**
 * The ingredients it's probably a kind of: core ones whose whole name is in
 * it. Specific ones before broad ones ("House Grenadine Syrup" → Grenadine
 * before Syrup), the one its name ends with first ("Pistachio Orgeat" is an
 * orgeat), then longest first ("Rich Demerara Syrup" → Demerara Syrup).
 */
export function kindGuesses<T extends { id: string; name: string | null }>(name: string, core: readonly T[], limit = 4): T[] {
  const words = ` ${ingredientKey(name)} `;
  if (!words.trim()) return [];
  // A specific kind beats a broad one ("Grenadine" over "Syrup"); then the one the name ends with.
  const rank = (c: T) => {
    const k = ingredientKey(c.name);
    return (BROAD.test(k) ? 0 : 2) + (words.endsWith(` ${k} `) ? 1 : 0);
  };
  return core
    .filter((c) => {
      const k = ingredientKey(c.name);
      return !!k && ` ${k} ` !== words && words.includes(` ${k} `);
    })
    .sort((a, b) => rank(b) - rank(a) || (b.name ?? '').length - (a.name ?? '').length)
    .slice(0, limit);
}

/** The strength the taste rules give it or its kind ("Gin" is about 40%), or null when they don't know. */
export function suggestedAbv(name: string, genericName: string | null): number | null {
  const rule = ruleFor({ name, genericName });
  return rule && rule.abv > 0 ? Math.round(rule.abv * 1000) / 10 : null;
}
