// An ingredient list as one line. Apart from lib/publicDrink so the shared menu page, which needs only this, does not load the rest.

/** One ingredient's name on a public page, and whether it's a product's (public_drink_ingredients). */
export interface IngredientName {
  name: string;
  brand: boolean;
  /** A garnish (public_drink_ingredients from 20261206495000; absent before it). */
  garnish?: boolean;
}

// ponytail: the place and proper words a generic's name keeps capitalised ("Islay Scotch"); grow it as names need, or store a reading name per ingredient.
const PROPER = new Set(['scotch', 'islay', 'irish', 'japanese', 'jamaican', 'mexican', 'french', 'italian', 'thai', 'london', 'earl', 'grey', 'campari', 'chartreuse']);

/** A generic's name as it reads mid-sentence: "Sweet Vermouth" is "sweet vermouth", "Islay Scotch" stays. */
function midSentence(name: string): string {
  return name
    .split(' ')
    .map((w) => (PROPER.has(w.toLowerCase()) ? w : w.toLowerCase()))
    .join(' ');
}

/**
 * "Gin, Green Chartreuse, maraschino, lime": a drink's ingredient names as one
 * line, each once, in spec order. A product keeps its capitals, a generic
 * reads in lower case (ppl-pub-menu-phone). Null with none.
 */
export function ingredientsLine(names: readonly IngredientName[]): string | null {
  const once = names.filter((n, i) => n.name && names.findIndex((o) => o.name === n.name) === i);
  return once.length ? once.map((n, i) => (i && !n.brand ? midSentence(n.name) : n.name)).join(', ') : null;
}
