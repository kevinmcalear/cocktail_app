// A finish (a spray, a rinse, a float) is counted and done at the station too, never bottled.
// The same list is app_recipe_presentation.is_garnish's and public_drink_ingredients' (20261206495000; lib/batch.check.ts keeps them equal).
export const GARNISH_UNITS = new Set(['each', 'pinch', 'sprig', 'leaf', 'peel', 'twist', 'discard', 'wheel', 'slice', 'cube', 'wedge', 'rim', 'spray', 'rinse', 'float', 'grated']);

/** A count unit (twist, wheel, each): a garnish, never a liquid. */
export function isGarnishUnit(unit: string | null | undefined): boolean {
  return GARNISH_UNITS.has((unit ?? '').toLowerCase());
}

/** A garnish line: a count unit, but not an egg (an egg white counted "1 each" goes in the drink). */
export function isGarnish(unit: string | null | undefined, name: string | null | undefined): boolean {
  return isGarnishUnit(unit) && !/\begg/i.test(name ?? '');
}
