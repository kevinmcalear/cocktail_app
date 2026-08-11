/** Cocktail recipe units. Stored as short codes on recipes.unit (text). */
export const DEFAULT_UNIT = 'ml';

export type RecipeUnit = {
  value: string;
  label: string;
  group: 'volume' | 'count';
};

/** Standard bar units: metric (intl) + US + garnish/count. */
export const RECIPE_UNITS: RecipeUnit[] = [
  // Volume — metric / international
  { value: 'ml', label: 'ml', group: 'volume' },
  { value: 'cl', label: 'cl', group: 'volume' },
  // Volume — US
  { value: 'oz', label: 'oz', group: 'volume' },
  // Volume — bar-specific
  { value: 'dash', label: 'dash', group: 'volume' },
  { value: 'drop', label: 'drop', group: 'volume' },
  { value: 'bsp', label: 'barspoon', group: 'volume' },
  { value: 'tsp', label: 'tsp', group: 'volume' },
  { value: 'tbsp', label: 'tbsp', group: 'volume' },
  { value: 'splash', label: 'splash', group: 'volume' },
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
];

export function unitLabel(value: string | null | undefined, fallback = DEFAULT_UNIT): string {
  if (!value) return fallback;
  return RECIPE_UNITS.find((u) => u.value === value)?.label ?? value;
}

export function isKnownUnit(value: string | null | undefined): boolean {
  if (!value) return false;
  return RECIPE_UNITS.some((u) => u.value === value);
}
