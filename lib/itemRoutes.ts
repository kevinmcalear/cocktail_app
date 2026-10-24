export type ItemCategory = 'Cocktail' | 'Beer' | 'Wine' | 'Ingredient';

/**
 * The detail screen for a catalogue item. Beer and wine ids in the catalogue
 * carry a `beer-`/`wine-` prefix, which their screens accept as is.
 */
export function itemHref(category: ItemCategory | undefined, id: string): string {
  switch (category) {
    case 'Beer':
      return `/beer/${id}`;
    case 'Wine':
      return `/wine/${id}`;
    case 'Ingredient':
      return `/ingredient/${id}`;
    default:
      return `/cocktail/${id}`;
  }
}

/**
 * A drink's page: signed in, the in-app page (/cocktail/<id>), which shows a
 * bar's published drink to people outside the bar too; signed out, its public
 * page (/d/<id>), with the website frame and Sign in.
 */
export function drinkPageHref(id: string, signedIn: boolean): string {
  return signedIn ? `/cocktail/${id}` : `/d/${id}`;
}

/** The drink in a drink page link (/cocktail/<id>), or null for any other page. */
export function drinkIdFromHref(href: string | null | undefined): string | null {
  return href?.startsWith('/cocktail/') ? href.slice('/cocktail/'.length) || null : null;
}

/** CustomIcons key to draw when an item has no image yet. */
export function fallbackGlass(category: ItemCategory | undefined): string {
  if (category === 'Beer') return 'Beer';
  if (category === 'Wine') return 'Wine';
  return 'Coupe';
}
