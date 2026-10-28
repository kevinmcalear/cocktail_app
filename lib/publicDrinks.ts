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

// Each card's searchable text in lower case, made once: a search reads every card again on every letter.
const HAYSTACKS = new WeakMap<SearchItem, string>();

/** Does a search card match the typed query (name, description, ingredient or credit)? `q` in lower case. */
export function matchesQuery(item: SearchItem, q: string): boolean {
  let text = HAYSTACKS.get(item);
  if (text === undefined) {
    // One field to a line, so a match never runs across two of them.
    text = [item.name, item.description ?? '', ...(item.recipes ?? []).map((r) => r.ingredient?.name ?? ''), item.fromBar ?? ''].join('\n').toLowerCase();
    HAYSTACKS.set(item, text);
  }
  return text.includes(q);
}

/** The small line under a search card: who a bar's drink is credited to, and when it was on the menu. */
export function searchCardMeta(item: SearchItem): string | undefined {
  return [item.fromBar, item.menuRun].filter(Boolean).join(' · ') || undefined;
}

/** Search order: by name, except bars' drinks on a menu now come before past ones. */
export function compareSearchItems(a: SearchItem, b: SearchItem): number {
  return (a.menuOrder ?? 1) - (b.menuOrder ?? 1) || a.name.localeCompare(b.name);
}
