// Where a thing on your bar lives on My Bar: with the bottles, in the fridge
// and pantry, on the lab shelf, or with your house preps. Kit is the
// equipment list (lib/techniques/equipment.ts), not catalog items, so it
// never comes through here.

import { technicalIngredientFor } from './techniques/ingredients';

export type BarSection = 'bottles' | 'fridge' | 'lab' | 'preps';

/** `short`: the name in the section filters. `add`: the label on the section's Add tile. */
export const SECTIONS: Record<BarSection | 'kit', { title: string; short: string; add: string; blurb: string; empty: string }> = {
  bottles: { title: 'Bottles', short: 'Bottles', add: 'Add bottles', blurb: 'Spirits, liqueurs, wine, beer and bitters.', empty: 'Spirits, liqueurs, wine and bitters.' },
  fridge: { title: 'Fridge & pantry', short: 'Fridge', add: 'Add more', blurb: 'Tap the staples you keep. Anything else (milk, pineapple, coffee) comes in from Add.', empty: '' },
  lab: { title: 'Lab shelf', short: 'Lab', add: 'Add to the lab', blurb: 'Acids, enzymes and texture: for cordials, acid-adjusting, clarifying and foams.', empty: 'Acids and enzymes, for when you get curious.' },
  preps: { title: 'House preps', short: 'Preps', add: 'Add a prep', blurb: 'What you’ve made and have in the fridge. They count like bottles.', empty: 'Syrups and cordials you make yourself.' },
  kit: { title: 'Kit', short: 'Kit', add: 'Add kit', blurb: 'Pots, jars, strainers, a fridge and a freezer are taken as given.', empty: 'Scales, whippers and beyond.' },
};

// Acids, enzymes, gums and the like, beyond the ones the technique library knows by name.
const LAB = /\b(acid|pectinex|pectinase|pectic enzyme|enzyme|xanthan|agar|gelatine?|gellan|methyl ?cellulose|alginate|calcium (lactate|chloride)|lecithin|versawhip|quillaja|gum arabic|maltodextrin|sodium citrate|glycerine?|msg|monosodium glutamate|sucrose esters?|tylose|carrageenan|guar gum|potassium sorbate|sodium benzoate)\b/;
// Things people make, even when the catalog has no recipe for them.
const MADE = /\b(cordial|syrup|shrub|oleo|orgeat|falernum|grenadine|tincture|infusion|saline|solution|super juice|acid[- ]adjusted|gomme|sherbet)\b/;
// Mixers sit in the fridge, even the ones named like beer.
const MIXER = /\b(soda|tonic|ginger beer|ginger ale|root beer|cola|lemonade|kombucha|seltzer|sparkling water|mineral water|water|non-alcoholic|alcohol-free|seedlip)\b/;
const ALCOHOL = /\b(spirits?|gin|genever|jenever|vodka|rum|rhum|cacha[cç]a|tequila|mezcal|sotol|raicilla|bacanora|whisk(e)?y|bourbon|rye|scotch|brandy|cognac|armagnac|calvados|applejack|pisco|grappa|eau de vie|kirsch|singani|absinthe|liqueurs?|cr[eè]me de|schnapps|triple sec|cura[cç]ao|amaretto|limoncello|amar[oi]|fernet|vermouth|wermut|quinquina|aperitivo|aperitif|campari|aperol|chartreuse|bitters|sherry|port|madeira|marsala|wine|champagne|prosecco|cava|cr[eé]mant|sake|shochu|soju|baijiu|beer|lager|ale|stout|porter|ipa|pilsner|cider|aquavit|akvavit|ouzo|arak|pastis|piquette)\b/;

export interface Sortable {
  name: string;
  /** What it's a kind of ("Acid", "Gin"), when known. */
  kind?: string | null;
  /** items.ingredient_role: product, generic or prep. */
  role?: string | null;
  abv?: number | null;
  /** It has a recipe of its own: made, not bought. */
  hasRecipe?: boolean;
}

/** The My Bar section for one ingredient. */
export function barSection({ name, kind, role, abv, hasRecipe }: Sortable): BarSection {
  const names = [name, kind ?? ''].map((n) => n.toLowerCase());
  if (role === 'prep' || (role !== 'product' && (hasRecipe || MADE.test(names[0])))) return 'preps';
  if (technicalIngredientFor(name) || names.some((n) => LAB.test(n))) return 'lab';
  if (abv && abv > 0) return 'bottles';
  if (MIXER.test(names[0])) return 'fridge';
  if (names.some((n) => ALCOHOL.test(n)) || role === 'product') return 'bottles';
  return 'fridge';
}

/** When a house prep went on the shelf, as "Made today", "Made yesterday" or "Made 3 Oct". */
export function madeLine(addedAt: string | null | undefined, now = new Date()): string | null {
  if (!addedAt) return null;
  const at = new Date(addedAt);
  if (Number.isNaN(at.getTime())) return null;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days <= 0) return 'Made today';
  if (days === 1) return 'Made yesterday';
  const sameYear = at.getFullYear() === now.getFullYear();
  return `Made ${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })}`;
}
