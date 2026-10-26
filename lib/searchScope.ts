import { foldName } from '@/lib/discover';
import { compareSearchItems, matchesQuery } from '@/lib/publicDrinks';
import type { SearchItem } from '@/types/search';

/**
 * Where the one search looks. `mine`: the active venue's library, or your own
 * drinks in home mode. `area`: bars and their drinks inside Discover's area
 * (only offered from Discover). `everywhere`: every public bar, drink,
 * bartender and classic.
 */
export type SearchScope = 'mine' | 'area' | 'everywhere';

/** How many rows each group shows before "All 12" (three, as the search boards draw it). */
export const PER_GROUP = 3;
/**
 * Rows each tap on "Show more" adds. Results sit in scroll views (and
 * Discover's sheet) that don't virtualize, so a long group grows a page at a time.
 */
export const RESULT_PAGE = 25;

/** How many rows a group shows after a tap: all of them when under two pages are left, else a page more. */
export function moreCount(total: number, shown: number): number {
  return total - shown < 2 * RESULT_PAGE ? total : shown + RESULT_PAGE;
}

/** The group's button: "All 12" when a tap shows the rest, "Show more (96)" while it doesn't, null once all show. */
export function moreLabel(total: number, shown: number): string | null {
  if (shown >= total) return null;
  return moreCount(total, shown) === total ? `All ${total}` : `Show more (${total - shown})`;
}

/** The scope switch's options, in order. `area` only when an area label is given. */
export function scopeOptions(mineLabel: string, areaLabel: string | null): { value: SearchScope; label: string; detail: string }[] {
  return [
    { value: 'mine' as const, label: mineLabel, detail: mineLabel === 'Your drinks' ? 'What you’ve made and saved' : 'Drinks, house-made, menus and bottles' },
    ...(areaLabel ? [{ value: 'area' as const, label: areaLabel, detail: 'Bars and drinks on the map' }] : []),
    { value: 'everywhere' as const, label: 'Everywhere', detail: 'Every bar, bartender and classic' },
  ];
}

/**
 * Where the search circle starts: the place you came from (search-starts-here,
 * decided 22 Oct 2026). Discover starts on This area, or Everywhere when its
 * area is everywhere; every other tab starts on the venue in venue mode and on
 * Everywhere at home (`mine`, from useSearchMine).
 */
export function startScope(fromTab: string | null, mine: SearchScope, hasArea: boolean): SearchScope {
  if (fromTab === 'discover') return hasArea ? 'area' : 'everywhere';
  return mine;
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

/** A kind of result, and its type chip. */
export type SearchKind = 'drinks' | 'bars' | 'people' | 'ingredients' | 'menus';

/**
 * The type chips over the results: everything, or one kind. `canmake`, at a
 * venue on Everywhere: only drinks its back bar can make (QA Q37).
 */
export type SearchShow = 'all' | SearchKind | 'canmake';

/** How many of each kind the results found, for the type chips' counts, and how many drinks the venue can make. */
export type ShowCounts = Partial<Record<Exclude<SearchShow, 'all'>, number>>;

const SHOW_LABEL: Record<SearchKind, string> = { drinks: 'Drinks', bars: 'Bars', people: 'People', ingredients: 'Ingredients', menus: 'Menus' };

/** The chips: All, then each kind that found something, in this order. None when only one kind found anything. */
export function showOptions(counts: ShowCounts): { value: SearchShow; label: string; count?: number }[] {
  const kinds = (Object.keys(SHOW_LABEL) as SearchKind[]).filter((k) => (counts[k] ?? 0) > 0);
  if (kinds.length < 2) return [];
  return [{ value: 'all', label: 'All' }, ...kinds.map((k) => ({ value: k, label: SHOW_LABEL[k], count: counts[k] }))];
}

/** Whether a group of this kind shows under the picked chip. Can make keeps the drinks. */
export function shows(show: SearchShow | undefined, kind: SearchKind): boolean {
  return !show || show === 'all' || show === kind || (show === 'canmake' && kind === 'drinks');
}

/**
 * What the typed word could finish as ("negr" to "negroni"): names among the
 * results that start with it, lower-cased, shortest first, at most `max`.
 * None for one letter, or once the query is a whole name.
 */
export function completions(names: readonly string[], query: string, max = 2): string[] {
  const q = foldName(query);
  if (q.length < 2) return [];
  const out: string[] = [];
  for (const name of names) {
    const n = foldName(name);
    if (n === q) return [];
    if (!n.startsWith(q) || out.includes(n)) continue;
    out.push(n);
  }
  return out.sort((a, b) => a.length - b.length).slice(0, max);
}
