import type { SearchItem } from '@/types/search';

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

/** The small line under a search card: who a bar's drink is credited to, and when it was on the menu. */
export function searchCardMeta(item: SearchItem): string | undefined {
  return [item.fromBar, item.menuRun].filter(Boolean).join(' · ') || undefined;
}

/** Search order: by name, except bars' drinks on a menu now come before past ones. */
export function compareSearchItems(a: SearchItem, b: SearchItem): number {
  return (a.menuOrder ?? 1) - (b.menuOrder ?? 1) || a.name.localeCompare(b.name);
}
