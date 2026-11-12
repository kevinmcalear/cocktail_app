import { useQueries } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useMemo } from 'react';

import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { specBookQuery } from '@/hooks/useSpecBook';
import { useViewAs } from '@/hooks/useViewAs';
import { whenIdle } from '@/lib/idleQueue';
import { bookSearchItem } from '@/lib/mineSearch';
import type { SpecBook } from '@/lib/specBook';
import { buildSearchIndex, NEAR_BELOW, rankHits, searchNames, searchNear, type SearchHit, type SearchIndex } from '@/lib/specSearch';

const NO_IDS: ReadonlySet<string> = new Set();

// One index per book, built the first time it's searched and kept with it.
const indexes = new WeakMap<SpecBook, SearchIndex>();
function indexOf(book: SpecBook): SearchIndex {
  let index = indexes.get(book);
  if (!index) {
    index = buildSearchIndex(book.barId, book.items);
    indexes.set(book, index);
  }
  return index;
}

const onNowIds = (books: readonly SpecBook[]) => new Set(books.flatMap((b) => b.onNow.flatMap((m) => m.sections.flatMap((s) => s.drinks.map((d) => d.id)))));

// Stable, so useQueries hands back the same result until a book changes.
const loadedBooks = (results: { data?: SpecBook; isLoading: boolean }[]) => ({
  books: results.flatMap((r) => (r.data ? [r.data] : [])),
  loading: results.some((r) => r.isLoading),
});

/**
 * Searches the spec books on this phone, with no network: every venue the
 * person works at, or just `barIds`. Names, ingredients, tags and makers
 * answer on the keystroke; near misses ("negorni") follow a frame later and
 * only when the rest found little (lib/specSearch.ts). Drinks on a list now
 * come first among equals. `hidden`: item ids this search leaves out.
 */
export function useSpecSearch(query: string, { barIds, limit = 50, hidden = NO_IDS }: { barIds?: readonly string[]; limit?: number; hidden?: ReadonlySet<string> } = {}) {
  const userId = useUserId();
  const { viewAsRoleLevel } = useViewAs();
  const { venues } = useActiveVenue();
  const ids = barIds ?? venues.map((v) => v.id);
  const { books, loading } = useQueries({ queries: ids.map((id) => specBookQuery(id, viewAsRoleLevel, userId)), combine: loadedBooks });

  // Built in a quiet moment once the books are here, not on the first letter: about 150 ms
  // for a 1,000-drink venue on an Android phone.
  useEffect(() => whenIdle(() => books.forEach(indexOf)), [books]);

  // Only rows a search shows count: a glass, a hidden ingredient or an R&D trial (`hidden`) that matches
  // must not hold back the near misses below.
  const named = useMemo(
    () => books.flatMap((book) => searchNames(indexOf(book), query)).filter((h) => !hidden.has(h.item.id!) && !!bookSearchItem(h.item)),
    [books, query, hidden]
  );
  // Near misses cost more: they run on the deferred query, after the letter is on screen.
  const settled = useDeferredValue(query);
  const near = useMemo(() => {
    if (named.length >= NEAR_BELOW || settled !== query) return [];
    const found = new Set(named.map((h) => h.item.id!));
    return books.flatMap((book) => searchNear(indexOf(book), settled, found)).filter((h) => !hidden.has(h.item.id!) && !!bookSearchItem(h.item));
  }, [books, named, settled, query, hidden]);

  const onNow = useMemo(() => onNowIds(books), [books]);
  const hits: SearchHit[] = useMemo(() => rankHits([...named, ...near], onNow, limit), [named, near, onNow, limit]);
  // Ready once every book has loaded or failed; no venues (home) is ready with nothing to search.
  // `books`: the ones in memory. None means nothing here can answer, and the caller falls back to its own lists.
  return { hits, ready: !loading, books };
}

const NO_BARS: readonly string[] = [];

/** Where a search opens with nothing typed yet: gets the venue's index ready, so the first letter doesn't build it. */
export function useSpecSearchWarm(barId: string | null) {
  const barIds = useMemo(() => (barId ? [barId] : NO_BARS), [barId]);
  useSpecSearch('', { barIds });
}
