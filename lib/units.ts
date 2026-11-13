/** Cocktail recipe units. Stored as short codes on recipes.unit (text). */
export const DEFAULT_UNIT = 'ml';

export type RecipeUnit = {
  value: string;
  label: string;
  group: 'volume' | 'weight' | 'count';
};

/** Standard bar units: metric (intl) + US + weight + garnish/count. */
export const RECIPE_UNITS: RecipeUnit[] = [
  // Volume: metric / international
  { value: 'ml', label: 'ml', group: 'volume' },
  { value: 'cl', label: 'cl', group: 'volume' },
  // Volume: US
  { value: 'oz', label: 'oz', group: 'volume' },
  // Volume: bar-specific
  { value: 'dash', label: 'dash', group: 'volume' },
  { value: 'drop', label: 'drop', group: 'volume' },
  { value: 'bsp', label: 'barspoon', group: 'volume' },
  { value: 'tsp', label: 'tsp', group: 'volume' },
  { value: 'tbsp', label: 'tbsp', group: 'volume' },
  { value: 'splash', label: 'splash', group: 'volume' },
  { value: 'top', label: 'top', group: 'volume' },
  // A finish: on the glass or on top, never poured in (counted, so never batched as ml)
  { value: 'spray', label: 'spray', group: 'count' },
  { value: 'rinse', label: 'rinse', group: 'count' },
  { value: 'float', label: 'float', group: 'count' },
  // Grated over the top (nutmeg, cinnamon): no amount needed, it reads "Grated" (Eddie tf-062).
  { value: 'grated', label: 'grated', group: 'count' },
  // Weight (specs weighed on a scale, e.g. Ethyl imports)
  { value: 'g', label: 'g', group: 'weight' },
  { value: 'kg', label: 'kg', group: 'weight' },
  // Count / garnish
  { value: 'each', label: 'each', group: 'count' },
  { value: 'pinch', label: 'pinch', group: 'count' },
  { value: 'sprig', label: 'sprig', group: 'count' },
  { value: 'leaf', label: 'leaf', group: 'count' },
  { value: 'peel', label: 'peel', group: 'count' },
  { value: 'twist', label: 'twist', group: 'count' },
  // A peel expressed over the drink, then thrown away: its oils, not the peel.
  { value: 'discard', label: 'discard', group: 'count' },
  { value: 'wheel', label: 'wheel', group: 'count' },
  { value: 'slice', label: 'slice', group: 'count' },
  { value: 'cube', label: 'cube', group: 'count' },
  { value: 'wedge', label: 'wedge', group: 'count' },
  { value: 'rim', label: 'rim', group: 'count' },
];

export function unitLabel(value: string | null | undefined, fallback = DEFAULT_UNIT): string {
  if (!value) return fallback;
  return RECIPE_UNITS.find((u) => u.value === value)?.label ?? value;
}

export function isKnownUnit(value: string | null | undefined): boolean {
  if (!value) return false;
  return RECIPE_UNITS.some((u) => u.value === value);
}

// Units that read in the plural past one ("3 drops"); ml, oz, g and spoons never do.
const PLURALS: Record<string, string> = {
  drop: 'drops', dash: 'dashes', spray: 'sprays', rinse: 'rinses', float: 'floats', splash: 'splashes', pinch: 'pinches', sprig: 'sprigs',
  leaf: 'leaves', peel: 'peels', twist: 'twists', wheel: 'wheels', slice: 'slices', cube: 'cubes', wedge: 'wedges', rim: 'rims',
};
/** Said as the line itself: one rinse of absinthe reads "Rinse  Absinthe", nutmeg with no amount "Grated  Nutmeg". */
const ONE_WORD = new Set(['rinse', 'float', 'grated']);

/** A spec amount as it reads: "3 drops", "1 dash", "22.5 ml", and a single rinse or float as just "Rinse". */
export function amountText(amount: string, unit: string | null | undefined): string {
  const u = (unit ?? '').trim();
  if (!u) return amount;
  const n = Number(amount);
  if (n === 1 && ONE_WORD.has(u)) return u[0].toUpperCase() + u.slice(1);
  return `${amount} ${n !== 1 ? (PLURALS[u] ?? u) : u}`;
}

/** A line with no amount whose unit says it all ("Grated", "Float"), else null. */
export function unitOnlyText(unit: string | null | undefined): string | null {
  const u = (unit ?? '').trim();
  return ONE_WORD.has(u) ? u[0].toUpperCase() + u.slice(1) : null;
}

/**
 * A person's Units when their bar's unit (bars.spec_unit) becomes known. A
 * unit saved before bars had one (`checked` false) is looked at once: the
 * same as the bar's, it was the bar's all along and follows the bar from
 * then on (null); a different one stays theirs.
 */
export function followBarUnit(s: { units: string | null; checked: boolean }, barUnit: string | null): { units: string | null; checked: boolean } {
  if (s.checked || !barUnit) return s;
  return { units: s.units === barUnit ? null : s.units, checked: true };
}

/**
 * A unit saved before bars had one. ml was what everyone started on, picked or
 * not, so it can't say the person chose it: it follows their bar like an unset
 * Units, or that bar's own unit could never reach them. Anything else they picked.
 */
export function savedUnit(unit: string | null | undefined): string | null {
  return unit && unit !== DEFAULT_UNIT ? unit : null;
}

/** "a large cube", "a spear", but "cubes" and "crushed": a lone piece takes "a", plurals and loose ice don't. */
export const overIce = (name: string) => {
  const n = name.trim().toLowerCase();
  return /^(large cube|big cube|cube|spear|sphere|block|ball)$/.test(n) ? `a ${n}` : n;
};

/** "Grated nutmeg": the garnish grated over the top, its name kept lower case after. */
export const grated = (name: string) => `Grated ${name.charAt(0).toLowerCase()}${name.slice(1)}`;

/** A number to two places at most, as an amount reads: 0.75, 1.5, 22.5. */
export const roundAmount = (n: number) => String(Math.round(n * 100) / 100);

const FRACTIONS: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

/**
 * An amount as typed, tidied to a plain number: "3/4" is "0.75", "1 1/2" and
 * "1½" are "1.5", "22,5" is "22.5". Anything else is left as it was typed.
 */
export function tidyAmount(text: string): string {
  const t = text.trim().replace(',', '.');
  if (!t) return '';
  const m = /^(\d+(?:\.\d+)?)?\s*(?:(\d+)\s*\/\s*(\d+)|([¼½¾⅓⅔⅛]))?$/.exec(t);
  if (!m || (!m[1] && !m[2] && !m[4])) return text.trim();
  let n = m[1] ? parseFloat(m[1]) : 0;
  if (m[2] && m[3] && +m[3] > 0) n += +m[2] / +m[3];
  if (m[4]) n += FRACTIONS[m[4]];
  return roundAmount(n);
}

/** Countries whose bars write specs in ounces. */
const OZ_COUNTRIES = new Set(['US', 'LR', 'MM']);

/**
 * The unit a new bar starts on: its country's (a United States bar pours in
 * oz, so 2 oz never reads as 60 ml), else ml. A unit its owner has for
 * themselves is not a pick for the bar (it may be a guess from their phone,
 * review 12 Nov: a British home user's New York bar got ml), so it plays no
 * part; the bar's Admins pick its unit in its settings. Also a home user's
 * first guess, from their phone's region.
 */
export function startingBarUnit(country: string | null | undefined): string {
  return country && OZ_COUNTRIES.has(country.toUpperCase()) ? 'oz' : DEFAULT_UNIT;
}
