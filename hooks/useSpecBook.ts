import { queryOptions, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBars } from '@/hooks/useBars';
import { DRINK_PAGE_COLUMNS, toDrinkPage, type SpecLists } from '@/hooks/useCocktails';
import { dropdownKeys } from '@/hooks/useDropdowns';
import { fetchMenu, fetchVenueMenus } from '@/hooks/useMenus';
import { useViewAs } from '@/hooks/useViewAs';
import { allRowsById } from '@/lib/allRows';
import { menuStatus } from '@/lib/menus';
import { SPEC_BOOK_VERSION, specBookKey, type SpecBook } from '@/lib/specBook';
import { dropOtherSpecBooks, saveSpecBook } from '@/lib/specBookFile';
import { supabase } from '@/lib/supabase';
import type { MenuDetail } from '@/types/menus';

/** A book this old refreshes when the app opens or comes back; a write of yours refreshes it sooner (lib/react-query.ts). */
const BOOK_FRESH = 5 * 60 * 1000;

/**
 * Downloads a venue's whole spec book as the person may read it: the drink
 * page's own read (DRINK_PAGE_COLUMNS) for every item the venue keeps, each
 * one's parts, every list, and each list on now in full. Read as the person,
 * so the database's rules decide every row, as they do page by page.
 */
async function fetchSpecBook(barId: string, userId: string | null, specs: SpecLists | undefined): Promise<SpecBook> {
  const [rows, parts, menus] = await Promise.all([
    allRowsById((after, size) => {
      let query = supabase.from('app_item_presentation').select(DRINK_PAGE_COLUMNS).eq('bar_id', barId);
      if (after) query = query.gt('id', after);
      return query.order('id').limit(size);
    }),
    allRowsById((after, size) => {
      let query = supabase.from('items').select('id, parts').eq('bar_id', barId).not('parts', 'is', null);
      if (after) query = query.gt('id', after);
      return query.order('id').limit(size);
    }),
    fetchVenueMenus(barId, userId),
  ]);
  const now = Date.now();
  const onNow = await Promise.all(menus.filter((m) => menuStatus(m, now) === 'on').map((m) => fetchMenu(m.id)));
  const partsById = new Map(parts.map((p) => [p.id, p.parts]));
  return {
    v: SPEC_BOOK_VERSION,
    barId,
    syncedAt: now,
    items: rows.map((row) => toDrinkPage(row, specs, partsById.get(row.id))),
    menus,
    onNow: onNow.filter((m): m is MenuDetail => !!m),
  };
}

export function specBookQuery(barId: string, level: number | null, userId: string | null) {
  return queryOptions({
    queryKey: specBookKey(barId, level),
    enabled: !!userId,
    queryFn: async ({ client, signal }) => {
      const book = await fetchSpecBook(barId, userId, client.getQueryData<SpecLists>(dropdownKeys.specs));
      // A View as preview isn't saved, nor a book that landed after its reader signed out (the query was removed).
      if (level === null && !signal.aborted) await saveSpecBook(book);
      return book;
    },
    staleTime: BOOK_FRESH,
    // In memory for as long as the app runs: the drink pages and lists read from it.
    gcTime: Infinity,
    // "Opening" the app on a phone is coming back to it (lib/react-query.ts focusManager).
    refetchOnWindowFocus: true,
    // Saved as its own file (lib/specBook.ts), not with the query cache.
    meta: { persist: false },
  });
}

/** A venue's spec book, from the phone at once and refreshed behind it. Null venue: nothing. */
export function useSpecBook(barId: string | null | undefined) {
  const userId = useUserId();
  const { viewAsRoleLevel } = useViewAs();
  return useQuery({ ...specBookQuery(barId ?? '', viewAsRoleLevel, userId), enabled: !!userId && !!barId });
}

/**
 * Keeps a spec book on this phone for every venue the person works at:
 * synced when the app opens or comes back, and after their own writes. Run
 * once, at the app's root. A venue they've left loses its book once their
 * venues are known (never on a failed read, which would empty the phone offline).
 */
export function useSpecBooks() {
  const userId = useUserId();
  const { viewAsRoleLevel } = useViewAs();
  const { venues } = useActiveVenue();
  const bars = useBars();
  const client = useQueryClient();
  useQueries({ queries: venues.map((v) => specBookQuery(v.id, viewAsRoleLevel, userId)) });

  const known = bars.isSuccess && !!userId;
  const ids = venues.map((v) => v.id).join(',');
  useEffect(() => {
    if (known) void dropOtherSpecBooks(client, ids ? ids.split(',') : []);
  }, [known, ids, client]);
}
