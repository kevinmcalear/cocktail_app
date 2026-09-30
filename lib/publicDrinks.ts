import type { SearchItem } from '@/types/search';

/** The credit columns on a public drink: where it was first made, and who made it. */
export interface PublicDrinkCredit {
  origin_bar_profile_id: string | null;
  creator_profile_id: string | null;
}

/** Who a public drink's search card credits: the bar it came from, else its creator. */
export function creditName(drink: PublicDrinkCredit, names: Record<string, string>): string | undefined {
  return (
    (drink.origin_bar_profile_id && names[drink.origin_bar_profile_id]) ||
    (drink.creator_profile_id && names[drink.creator_profile_id]) ||
    undefined
  );
}

/**
 * The library plus the public drinks it doesn't already hold (a drink you
 * added yourself shows in your library, so it isn't listed twice).
 */
export function withPublicDrinks(library: SearchItem[], publicDrinks: SearchItem[]): SearchItem[] {
  if (publicDrinks.length === 0) return library;
  const own = new Set(library.map((i) => i.id));
  return library.concat(publicDrinks.filter((d) => !own.has(d.id)));
}

/** Does a search card match the typed query (name, description, ingredient or credit)? */
export function matchesQuery(item: SearchItem, q: string): boolean {
  return (
    item.name.toLowerCase().includes(q) ||
    !!item.description?.toLowerCase().includes(q) ||
    !!item.recipes?.some((r) => r.ingredient?.name?.toLowerCase().includes(q)) ||
    !!item.fromBar?.toLowerCase().includes(q)
  );
}
