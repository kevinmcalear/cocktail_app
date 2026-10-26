/**
 * The unit a new line starts in, from its name. One guess for every place a
 * line is added (the drink wizard, the drink desk, the house-made builder),
 * so sugar is weighed in both and bitters are dashed in both (Q18, Q19).
 */

// Weighed, never poured: sugar, salt, powders and acids.
const DRY = /\b(sugar|salt|cream of tartar|msg|powder(ed)?|(citric|malic|tartaric|lactic|ascorbic|succinic) acid|gelatine?|agar|xanthan|pectin|cocoa|matcha|peppercorns?|coffee grounds|ground coffee|tea leaves)\b/;
// A dry word in something poured: sugar syrup, salt solution, cocoa liqueur.
const POURED = /syrup|cordial|solution|saline|juice|water|liqueur|tincture|bitters|soda|cream(?! of tartar)|milk|liquid|\boil\b|extract|brine|shrub|honey|wine|vinegar|\brim\b/;
const SOFT = /soda|tonic|ginger (beer|ale)|champagne|prosecco|cava|sparkling|cola|lemonade/;

/** Loose plain salt in a drink, the kind saline measures better. Not saline, a salted syrup, a salt rim or a flavoured salt. */
export function isLooseSalt(name: string): boolean {
  // Plain salt only: celery, smoked or chili salt is there for its flavour, which saline doesn't have.
  return /^((sea|kosher|table|fine|flaky|maldon|rock|pink|himalayan)\s+)*salt(\s+flakes)?$/.test(name.trim().toLowerCase());
}

/**
 * The unit a new line starts in: dashes of bitters, drops of saline, a top
 * of soda, eggs counted, sugar and salt in grams, otherwise your usual.
 */
export function guessUnit(name: string, usual: string): string {
  const n = name.toLowerCase();
  if (/bitters/.test(n)) return 'dash';
  if (/saline|salt solution|tincture/.test(n)) return 'drop';
  if (SOFT.test(n) && !/syrup|cordial/.test(n)) return 'top';
  if (/\begg\b|egg white|egg yolk/.test(n)) return 'each';
  if (/sugar (cube|lump)s?/.test(n)) return 'each';
  if (DRY.test(n) && !POURED.test(n)) return 'g';
  return usual;
}

/** The unit a typed pour ("30 pommeau") lands in: as typed, else the ingredient's own. A number typed means it isn't a top. */
export function typedUnit(name: string, unit: string | null, usual: string): string {
  if (unit) return unit;
  const guess = guessUnit(name, usual);
  return guess === 'top' ? usual : guess;
}

/** In a house-made recipe: the same guess, in ml for what's poured. A batch is never topped. */
export function prepUnit(name: string): string {
  const unit = guessUnit(name, 'ml');
  return unit === 'top' ? 'ml' : unit;
}
