import { useEffect, useMemo } from 'react';

import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import type { SearchMine } from '@/hooks/useSearchMine';
import { useSpecSearch } from '@/hooks/useSpecSearch';
import { itemIdOf } from '@/lib/drinksFilters';
import { mineGroups, narrowView } from '@/lib/mineSearch';
import { searchShown } from '@/lib/searchProbe';
import type { SearchItem } from '@/types/search';

const NO_BARS: readonly string[] = [];

/** The venue's library (or your own drinks), less what it hides. */
export function useMineCatalog(mine: SearchMine) {
  const { items: catalog, isLoading } = useSearchCatalog(mine.contextIds);
  const items = useMemo(() => {
    const hidden = new Set(mine.hiddenIds);
    return hidden.size ? catalog.filter((i) => !hidden.has(itemIdOf(i.id))) : catalog;
  }, [catalog, mine.hiddenIds]);
  return { items, isLoading };
}

/**
 * Your place's matches for what's typed, by kind (lib/mineSearch.ts): from
 * the venue's spec book on this phone, so it answers on the keystroke and
 * with no signal; from your own lists at home. `near`: where "Did you mean"
 * looks. `items`: the place's lists, for what its rows say (useMineFacts).
 */
export function useMineSearch(mine: SearchMine, query: string) {
  const { items, isLoading } = useMineCatalog(mine);
  const barIds = useMemo(() => (mine.venueId ? [mine.venueId] : NO_BARS), [mine.venueId]);
  const book = useSpecSearch(mine.venueId ? query : '', { barIds, limit: Infinity });
  const local = book.books.length > 0;
  const hidden = useMemo(() => new Set(mine.hiddenIds), [mine.hiddenIds]);
  const found = useMemo(() => mineGroups(items, query, local ? book.hits : null, book.books, hidden), [items, query, local, book.hits, book.books, hidden]);
  useEffect(searchShown, [query]);
  // The book answers at once; without one, wait for it or for the lists.
  return { ...found, items, isLoading: local ? false : !book.ready || isLoading };
}

/** A venue's list (the Drinks tab's view) narrowed to what's typed, A to Z, by its spec book (lib/mineSearch.ts narrowView). */
export function useViewSearch(barId: string | null, view: readonly SearchItem[], query: string) {
  const barIds = useMemo(() => (barId ? [barId] : NO_BARS), [barId]);
  const book = useSpecSearch(query, { barIds, limit: Infinity });
  useEffect(searchShown, [query]);
  return narrowView(view, query, book.books.length ? book.hits : null, book.books);
}
