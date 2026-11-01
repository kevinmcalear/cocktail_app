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

/** The add-drink wizard, started on a name, for a venue or (no bar) your own drinks. */
export function newDrinkHref(name: string, barId: string | null): string {
  return `/add-cocktail?name=${encodeURIComponent(name)}${barId ? `&barId=${encodeURIComponent(barId)}` : ''}`;
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

/** The page a batch's label code opens: its house-made, read as scanned from that batch (Bet-labels "Scanned: its page"). */
export const batchPageUrl = (origin: string, itemId: string, batchId: string) => `${origin}/ingredient/${itemId}?batch=${encodeURIComponent(batchId)}`;

/**
 * Where Made. Label it. opens for a batch just logged: `/label?batch=<id>`
 * with the batch's own facts, so it draws before the batch has sent (Log
 * batch works with no signal). Without them it reads the batch.
 */
export function labelHref(b: { id: string; itemId: string; amount: number; unit: string; madeAt: string }): string {
  return `/label?${new URLSearchParams({ batch: b.id, item: b.itemId, amount: String(b.amount), unit: b.unit, made: b.madeAt })}`;
}
