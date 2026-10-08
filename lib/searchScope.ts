import { compareSearchItems, matchesQuery } from '@/lib/publicDrinks';
import type { SearchItem } from '@/types/search';

/**
 * Where the one search looks. `mine`: the active venue's library, or your own
 * drinks in home mode. `area`: bars and their drinks inside Discover's area
 * (only offered from Discover). `everywhere`: every public bar, drink,
 * bartender and classic.
 */
export type SearchScope = 'mine' | 'area' | 'everywhere';

/** How many rows each group shows before "All 12". */
export const PER_GROUP = 4;
/**
 * Rows each tap on "All 120" or "Show more" adds. Results sit in scroll views
 * (and Discover's sheet) that don't virtualize, so a group grows a page at a time.
 */
export const RESULT_PAGE = 25;

/** The group's button: "All 12" when one more page shows the rest, else "Show more (96)". */
export function moreLabel(total: number, shown: number): string | null {
  const rest = total - shown;
  if (rest <= 0) return null;
  return rest <= RESULT_PAGE ? `All ${total}` : `Show more (${rest})`;
}

/** The scope switch's options, in order. `area` only when an area label is given. */
export function scopeOptions(mineLabel: string, areaLabel: string | null): { value: SearchScope; label: string }[] {
  return [
    { value: 'mine' as const, label: mineLabel },
    ...(areaLabel ? [{ value: 'area' as const, label: areaLabel }] : []),
    { value: 'everywhere' as const, label: 'Everywhere' },
  ];
}

export interface CatalogGroups {
  drinks: SearchItem[];
  ingredients: SearchItem[];
  menus: SearchItem[];
}

const DRINKS: SearchItem['category'][] = ['Cocktail', 'Beer', 'Wine'];

/**
 * A library's matches for the typed query, by kind. Other bars' drinks never
 * land here (they belong to Everywhere), and drinks sort on-a-menu-now first.
 */
export function groupCatalog(items: readonly SearchItem[], query: string): CatalogGroups {
  const q = query.trim().toLowerCase();
  const hits = q ? items.filter((i) => !i.fromBar && matchesQuery(i, q)) : [];
  const of = (cats: SearchItem['category'][]) => hits.filter((i) => cats.includes(i.category)).sort(compareSearchItems);
  return { drinks: of(DRINKS), ingredients: of(['Ingredient']), menus: of(['Menu']) };
}

/** "Drinks · 3": a group's heading, with how many there are. */
export function groupLabel(label: string, count: number): string {
  return count ? `${label} · ${count}` : label;
}
