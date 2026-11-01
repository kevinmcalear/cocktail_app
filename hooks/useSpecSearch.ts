import { useQueries } from '@tanstack/react-query';
import { useDeferredValue, useMemo } from 'react';

import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { specBookQuery } from '@/hooks/useSpecBook';
import { useViewAs } from '@/hooks/useViewAs';
import type { SpecBook } from '@/lib/specBook';
import { buildSearchIndex, NEAR_BELOW, rankHits, searchNames, searchNear, type SearchHit, type SearchIndex } from '@/lib/specSearch';

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

// Stable, so useQueries hands back the same array until a book changes.
const loadedBooks = (results: { data?: SpecBook }[]) => results.flatMap((r) => (r.data ? [r.data] : []));

/**
 * Searches the spec books on this phone, with no network: every venue the
 * person works at, or just `barIds`. Names, ingredients, tags and makers
 * answer on the keystroke; near misses ("negorni") follow a frame later and
 * only when the rest found little (lib/specSearch.ts). Drinks on a list now
 * come first among equals.
 */
export function useSpecSearch(query: string, { barIds, limit = 50 }: { barIds?: readonly string[]; limit?: number } = {}) {
  const userId = useUserId();
  const { viewAsRoleLevel } = useViewAs();
  const { venues } = useActiveVenue();
  const ids = barIds ?? venues.map((v) => v.id);
  const books = useQueries({ queries: ids.map((id) => specBookQuery(id, viewAsRoleLevel, userId)), combine: loadedBooks });

  const named = useMemo(() => books.flatMap((book) => searchNames(indexOf(book), query)), [books, query]);
  // Near misses cost more: they run on the deferred query, after the letter is on screen.
  const settled = useDeferredValue(query);
  const near = useMemo(() => {
    if (named.length >= NEAR_BELOW || settled !== query) return [];
    const found = new Set(named.map((h) => h.item.id!));
    return books.flatMap((book) => searchNear(indexOf(book), settled, found));
  }, [books, named, settled, query]);

  const onNow = useMemo(() => onNowIds(books), [books]);
  const hits: SearchHit[] = useMemo(() => rankHits([...named, ...near], onNow, limit), [named, near, onNow, limit]);
  return { hits, ready: books.length > 0 };
}
