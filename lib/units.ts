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
/** Said as the line itself: one rinse of absinthe reads "Rinse  Absinthe". */
const ONE_WORD = new Set(['rinse', 'float']);

/** A spec amount as it reads: "3 drops", "1 dash", "22.5 ml", and a single rinse or float as just "Rinse". */
export function amountText(amount: string, unit: string | null | undefined): string {
  const u = (unit ?? '').trim();
  if (!u) return amount;
  const n = Number(amount);
  if (n === 1 && ONE_WORD.has(u)) return u[0].toUpperCase() + u.slice(1);
  return `${amount} ${n !== 1 ? (PLURALS[u] ?? u) : u}`;
}
