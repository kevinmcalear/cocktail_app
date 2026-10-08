/**
 * The add-ingredient wizard's draft and rules: a bottle, something made in
 * house, or a plain ingredient, one step per screen, kept on the device until
 * it's saved. Screens: components/screens/addIngredient; saving:
 * hooks/useCreateIngredient.ts.
 */
import { ruleFor } from '../supabase/functions/_shared/flavor';

import type { DraftPhoto } from './beerWineWizard';
import type { WizardLine, WizardPick } from './drinkWizard';
import { ingredientKey } from './ingredientNames';

export const INGREDIENT_STEPS = ['name', 'what', 'kind', 'maker', 'recipe', 'strength', 'notes', 'review'] as const;
export type IngredientStep = (typeof INGREDIENT_STEPS)[number];

/** What it is: items.ingredient_role, 'other' saved as not said. */
export type IngredientRole = 'product' | 'prep' | 'other';

/** The steps for what it is: a bottle has a maker and a strength, a house prep a recipe. */
export function ingredientSteps(role: IngredientRole | null): readonly IngredientStep[] {
  return INGREDIENT_STEPS.filter((s) => {
    if (s === 'maker') return role === 'product';
    if (s === 'recipe') return role === 'prep';
    if (s === 'strength') return role === 'product' || role === 'prep';
    return true;
  });
}

export const INGREDIENT_COPY: Record<IngredientStep, { title: string; short: string; intro?: string; optional: boolean }> = {
  name: { title: 'What’s the ingredient?', short: 'Name', optional: false },
  what: { title: 'What is it?', short: 'What it is', optional: true },
  kind: { title: 'What’s it a kind of?', short: 'Kind of', intro: 'So it’s found with the others, and specs can use either.', optional: true },
  maker: { title: 'Who makes it?', short: 'Maker', optional: true },
  recipe: { title: 'What goes in it?', short: 'Recipe', intro: 'The batch, in any amounts. Skip it if you’d rather add it later.', optional: true },
  strength: { title: 'How strong?', short: 'Strength', optional: true },
  notes: { title: 'Anything to add?', short: 'Notes', optional: true },
  review: { title: 'Look right?', short: 'Review', optional: false },
};

export const ROLE_COPY: Record<IngredientRole, { label: string; hint: string }> = {
  product: { label: 'A bottle', hint: 'Something you buy: a spirit, a liqueur, a tonic.' },
  prep: { label: 'Made in house', hint: 'A syrup, an infusion, a cordial or a batch.' },
  other: { label: 'Something else', hint: 'Fresh produce, a garnish, a plain ingredient.' },
};

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

export const hasIngredientContent = (d: IngredientDraft) => !!(d.name.trim() || d.role || d.generic || d.maker.trim() || d.lines.length);

const PREP = /syrup|orgeat|grenadine|falernum|gomme|sour mix|infus|cordial|oleo|shrub|tincture|batch|house|fat[- ]?wash|cold brew|sherbet|foam|brine|solution|clarified|mix\b|blend|reduction|ferment/;
const PLAIN = /juice|peel|zest|leaves|leaf|sprig|wheel|wedge|\bmint\b|\begg\b|cream|milk|salt|sugar|water|ice\b|fruit|berr|cherr|olive|cucumber|ginger root/;

/** A guess at what it is from its name and maker: "House Grenadine" is made in house, "Tanqueray" from a maker is a bottle. */
export function guessRole(name: string, maker: string): IngredientRole | null {
  const n = name.toLowerCase();
  if (PREP.test(n)) return 'prep';
  if (maker.trim()) return 'product';
  if (PLAIN.test(n)) return 'other';
  return null;
}

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
