/**
 * A bottle you buy, added on the desktop drink page under its own line
 * (board make-create-desktop, step 5): what it is, how strong
 * and its pack. What it is saves as the new row's kind (items.generic_id):
 * the kind its name says when the catalog has one ("Ki No Bi gin" is a Gin),
 * else the broad one picked ("Pommeau" is a Fortified wine).
 */
import { kindGuesses } from './ingredientWizard';
import { ingredientKey } from './ingredientNames';

export const BOTTLE_KINDS = [
  { id: 'spirit', label: 'Spirit' },
  { id: 'liqueur', label: 'Liqueur' },
  { id: 'wine', label: 'Wine or fortified' },
  { id: 'beer', label: 'Beer or cider' },
  { id: 'mixer', label: 'Mixer' },
] as const;
export type BottleKind = (typeof BOTTLE_KINDS)[number]['id'];

// The first that matches wins: a ginger beer is a mixer, a rum liqueur a liqueur.
const GUESSES: [BottleKind, RegExp][] = [
  ['mixer', /tonic|\bsoda\b|ginger (beer|ale)|\bcola\b|lemonade|seltzer|mixer/],
  ['beer', /\bbeer\b|lager|\bale\b|\bipa\b|stout|porter|pilsner|cider|perry/],
  ['wine', /wine|sherry|\bport\b|madeira|marsala|vermouth|pommeau|lillet|quinquina|\bfino\b|manzanilla|amontillado|oloroso|champagne|prosecco|\bcava\b|cr[eé]mant|\bsake\b/],
  ['liqueur', /liqueur|cr[eè]me de|amaro|aperitivo|triple sec|cura[cç]ao|schnapps|chartreuse|b[eé]n[eé]dictine|maraschino|falernum|campari|aperol/],
  ['spirit', /\bgin\b|vodka|\brum\b|rhum|whisk|bourbon|\brye\b|scotch|tequila|mezcal|brandy|cognac|armagnac|calvados|applejack|pisco|grappa|absinthe|genever|aquavit|akvavit|cacha[cç]a|baijiu|soju|sh[oō]ch[uū]|eau de vie|spirit/],
];

/** What a bottle probably is from its name ("Pommeau" is a wine or fortified), or null. */
export function guessBottleKind(name: string): BottleKind | null {
  const n = name.toLowerCase();
  return GUESSES.find(([, re]) => re.test(n))?.[0] ?? null;
}

// The catalog's broad kinds each one saves as.
const BROAD: Record<BottleKind, (name: string) => string> = {
  spirit: () => 'Spirit',
  liqueur: () => 'Liqueur',
  wine: (n) => (/wine|champagne|prosecco|cava|cr[eé]mant|sake/i.test(n) && !/fortified/i.test(n) ? 'Wine' : 'Fortified wine'),
  beer: (n) => (/cider|perry/i.test(n) ? 'Cider' : 'Beer'),
  mixer: () => 'Mixer',
};

/**
 * The kind a new bottle saves with: the one its name says from the core
 * catalog, while what it is was left as guessed; else the broad kind picked.
 * Null when neither is in the catalog.
 */
export function bottleKindRow<T extends { id: string; name: string | null }>(name: string, kind: BottleKind | null, core: readonly T[], all: readonly T[] = core): T | null {
  if (!kind) return null;
  if (kind === guessBottleKind(name)) {
    const said = kindGuesses(name, core, 1)[0];
    if (said) return said;
  }
  const broad = ingredientKey(BROAD[kind](name));
  return all.find((r) => ingredientKey(r.name) === broad) ?? null;
}
