/**
 * Searching your own place. At a venue the answer comes from its spec book
 * on this phone (lib/specSearch.ts): ranked, typo tolerant, no network and no
 * scan of the venue's lists on each letter. What no book holds keeps the
 * plain match (groupCatalog, matchesQuery): drafts, menus, and the shared
 * bottles a venue's drinks use. At home, or with no book on this phone, all
 * of it does. Pure; checked by lib/mineSearch.check.ts.
 */
import { matchesQuery } from '@/lib/publicDrinks';
import { toSearchItem } from '@/lib/searchCards';
import { groupCatalog, type CatalogGroups } from '@/lib/searchScope';
import { isHiddenFromSearch } from '@/lib/searchVisibility';
import type { SpecBook } from '@/lib/specBook';
import type { SearchHit } from '@/lib/specSearch';
import type { SearchItem } from '@/types/search';
import type { DatabaseItem } from '@/types/types';

const NO_IDS: ReadonlySet<string> = new Set();

// Made once per book item, so a drink is the same card on every letter.
const cards = new WeakMap<DatabaseItem, SearchItem | null>();

/** A spec book item as the search card the lists make of it; null for what search doesn't show (a glass, a method, an ingredient hidden from search). */
export function bookSearchItem(item: DatabaseItem): SearchItem | null {
  let card = cards.get(item);
  if (card === undefined) {
    card = item.item_type === 'ingredient' && isHiddenFromSearch(item) ? null : toSearchItem(item);
    cards.set(item, card);
  }
  return card;
}

// The card ids a book holds, once per book.
const held = new WeakMap<SpecBook, Set<string>>();
function heldBy(book: SpecBook): Set<string> {
  let ids = held.get(book);
  if (!ids) {
    ids = new Set(book.items.flatMap((item) => bookSearchItem(item)?.id ?? []));
    held.set(book, ids);
  }
  return ids;
}

// The rows of a catalog no book holds, worked out once per catalog and set of books: drafts, menus,
// and a drink or ingredient saved since the book was last synced.
const offBooks = new WeakMap<readonly SearchItem[], { books: readonly SpecBook[]; rest: SearchItem[] }>();
function offBook(catalog: readonly SearchItem[], books: readonly SpecBook[]): SearchItem[] {
  const kept = offBooks.get(catalog);
  if (kept && kept.books === books) return kept.rest;
  const ids = books.map(heldBy);
  const rest = catalog.filter((i) => i.isDraft || i.category === 'Menu' || !ids.some((set) => set.has(i.id)));
  offBooks.set(catalog, { books, rest });
  return rest;
}

export interface MineFound {
  groups: CatalogGroups;
  /** Where "Did you mean" looks for a close name: the book's near misses and the drafts at a venue, everything at home. */
  near: readonly SearchItem[];
}

/**
 * Your place's matches by kind. `hits`: the venue's spec book's answer,
 * closest first (hooks/useSpecSearch.ts), or null at home and when no book is
 * on this phone. With hits, the catalog's drinks and ingredients are never
 * matched here: only what the `books` don't hold is (drafts, menus, a row
 * saved since the last sync), after the book's rows.
 * `hidden`: item ids the venue's search leaves out (R&D trials).
 */
export function mineGroups(catalog: readonly SearchItem[], query: string, hits: readonly SearchHit[] | null, books: readonly SpecBook[], hidden: ReadonlySet<string> = NO_IDS): MineFound {
  if (!hits) return { groups: groupCatalog(catalog, query), near: catalog };
  const rest = offBook(catalog, books);
  const typed = groupCatalog(rest, query);
  const drinks: SearchItem[] = [];
  const ingredients: SearchItem[] = [];
  const near: SearchItem[] = [];
  for (const hit of hits) {
    const card = bookSearchItem(hit.item);
    if (!card || hidden.has(hit.item.id!)) continue;
    if (hit.tier === 3) near.push(card);
    else (card.category === 'Ingredient' ? ingredients : drinks).push(card);
  }
  return {
    groups: { drinks: [...drinks, ...typed.drinks], ingredients: [...ingredients, ...typed.ingredients], menus: typed.menus },
    near: [...near, ...rest],
  };
}

/**
 * A list at a venue (the Drinks tab's view) narrowed to what's typed, A to Z.
 * Rows the books hold show when the books found them (`hits`); a row no book
 * holds (a shared bottle the drinks use) keeps the plain match. `near`: where
 * "Did you mean" looks. Null hits: no book on this phone, so every row keeps
 * the plain match.
 */
export function narrowView(view: readonly SearchItem[], query: string, hits: readonly SearchHit[] | null, books: readonly SpecBook[]): { shown: SearchItem[]; near: readonly SearchItem[] } {
  const az = (rows: SearchItem[]) => rows.sort((a, b) => a.name.localeCompare(b.name));
  const q = query.trim().toLowerCase();
  if (!q) return { shown: az([...view]), near: view };
  if (!hits) return { shown: az(view.filter((i) => matchesQuery(i, q))), near: view };
  const found = new Set<string>();
  const close = new Set<string>();
  for (const hit of hits) {
    const id = bookSearchItem(hit.item)?.id;
    if (id) (hit.tier === 3 ? close : found).add(id);
  }
  const ids = books.map(heldBy);
  const shown: SearchItem[] = [];
  const near: SearchItem[] = [];
  for (const row of view) {
    if (found.has(row.id)) shown.push(row);
    else if (close.has(row.id)) near.push(row);
    else if (ids.some((set) => set.has(row.id))) continue;
    else if (matchesQuery(row, q)) shown.push(row);
    else near.push(row);
  }
  return { shown: az(shown), near };
}
