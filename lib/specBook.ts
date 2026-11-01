import type { QueryClient } from '@tanstack/react-query';

import type { MenuDetail, MenuSummary } from '@/types/menus';
import type { DatabaseItem } from '@/types/types';

/**
 * A venue's spec book: everything a bartender reads behind the bar, saved on
 * the phone so it opens with no signal (hooks/useSpecBook.ts). Plain JSON,
 * one file per venue (lib/specBookFile.ts).
 */
export interface SpecBook {
  /** The shape's version: a book saved by older code is fetched again, not read. */
  v: typeof SPEC_BOOK_VERSION;
  barId: string;
  /** When it was downloaded, in ms. */
  syncedAt: number;
  /** Every item the venue keeps (drinks, house-mades, bottles), each as its page reads it (hooks/useCocktails.ts toDrinkPage). */
  items: DatabaseItem[];
  /** Every list the venue has (hooks/useMenus.ts useVenueMenus). */
  menus: MenuSummary[];
  /** Each list on now, in full (useMenu). */
  onNow: MenuDetail[];
}

export const SPEC_BOOK_VERSION = 1;

/** The book's query key. `level` is the View as role level: a preview is never saved to the phone. */
export const specBookKey = (barId: string, level: number | null = null) => ['spec-book', barId, level] as const;

export function isSpecBook(value: unknown): value is SpecBook {
  const book = value as SpecBook | null;
  return !!book && book.v === SPEC_BOOK_VERSION && typeof book.barId === 'string' && Array.isArray(book.items);
}

/** The books in memory for this View as level (the person's own when null). */
export function booksInCache(client: QueryClient, level: number | null = null): SpecBook[] {
  return client
    .getQueriesData<SpecBook>({ queryKey: ['spec-book'] })
    .filter(([key, book]) => key[2] === level && !!book)
    .map(([, book]) => book!);
}

export function bookFor(client: QueryClient, barId: string, level: number | null = null): SpecBook | undefined {
  return client.getQueryData<SpecBook>(specBookKey(barId, level));
}

// Built once per book: a lookup per keystroke or page open stays a map read.
const itemsById = new WeakMap<SpecBook, Map<string, DatabaseItem>>();

function itemIndex(book: SpecBook): Map<string, DatabaseItem> {
  let index = itemsById.get(book);
  if (!index) {
    index = new Map(book.items.map((item) => [item.id ?? '', item]));
    itemsById.set(book, index);
  }
  return index;
}

/** An item from any spec book in memory, with when that book was synced. */
export function bookItem(client: QueryClient, id: string | undefined, level: number | null = null): { item: DatabaseItem; syncedAt: number } | undefined {
  if (!id) return undefined;
  for (const book of booksInCache(client, level)) {
    const item = itemIndex(book).get(id);
    if (item) return { item, syncedAt: book.syncedAt };
  }
  return undefined;
}

/** A list on now from any spec book in memory. */
export function bookMenu(client: QueryClient, menuId: string): { menu: MenuDetail; syncedAt: number } | undefined {
  for (const book of booksInCache(client)) {
    const menu = book.onNow.find((m) => m.id === menuId);
    if (menu) return { menu, syncedAt: book.syncedAt };
  }
  return undefined;
}
