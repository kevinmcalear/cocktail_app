import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { useDebounced } from '@/hooks/useDiscover';
import { useTrackSearch } from '@/hooks/useTrackSearch';
import { foldName } from '@/lib/discover';
import { useMyHadIds } from '@/hooks/useRankings';
import { closedBars, cursorAfter, kindParams, toDiscoverBar, toDiscoverDrink, withoutHad, type BarRow, type DiscoverBar, type DiscoverDrink, type DrinkFilter, type DrinkRow } from '@/lib/discoverDrinks';
import { areaParams, roundCoord, type Area } from '@/lib/nearMe';
import { allRowsById } from '@/lib/allRows';
import { supabase } from '@/lib/supabase';

/**
 * Discover's data, a page at a time (supabase/migrations/20261009700000_discover_index.sql):
 * the matching drinks in an area best first (discover_list), the bars in an
 * area (discover_bars). The
 * server matches, ranks and counts; the phone gets what it shows. Small, so
 * all of it is saved between launches: Discover opens on the last results
 * and refreshes behind them. Signed-in only, like every shared drink.
 */

/** Drinks per page: the list shows 8, then more a page at a time. */
const PAGE = 30;

/** The search as the server folds it, so "Negroni" and "negroni " are one query. */
const searchKey = (search: string) => foldName(search);

interface ListOptions {
  /** One bar's drinks instead of the area's. */
  barId?: string | null;
  enabled?: boolean;
  /** Drinks per page (at most 500). */
  pageSize?: number;
  /** Nearest: sort by distance from here (the bars with no place drop out). */
  from?: { latitude: number; longitude: number } | null;
  /** Only drinks on one of their bar's menus now (Discover's list unless "Past menus" is on). */
  onNow?: boolean;
  /** Mixed: one drink from every bar, then a second, and so on (browsing, not Nearest or one bar). */
  mix?: boolean;
  /** Read only once there's a search: the debounce starts empty, and the whole list isn't wanted. */
  searchedOnly?: boolean;
}

interface ListPage {
  drinks: DiscoverDrink[];
  totals: { drinks: number; bars: number } | null;
}

/**
 * The drinks that match, best first, a page at a time. `totals` (how many,
 * at how many bars) come with the first page. A new search or filter in the
 * same area keeps the last results up while it loads; a new area doesn't, so
 * the map refits.
 */
export function useDiscoverList(filter: DrinkFilter, { barId = null, enabled = true, pageSize = PAGE, from = null, onNow = false, mix = false, searchedOnly = false }: ListOptions = {}) {
  const signedIn = !!useAuth().user;
  const search = searchKey(useDebounced(filter.search, 250));
  const where = barId ? {} : areaParams(filter.area);
  const kinds = kindParams(filter.kinds);
  // "Search this area" keeps the last results up while the new ones load, so the list doesn't blank.
  const searchedHere = !barId && filter.area.kind === 'point' && filter.area.source === 'map';
  // On the ~100 m grid, so a phone's position wobbling doesn't ask again.
  const near = from ? { p_from_latitude: roundCoord(from.latitude), p_from_longitude: roundCoord(from.longitude) } : null;
  const query = useInfiniteQuery({
    queryKey: ['discover-list', where, barId, kinds, search, pageSize, near, ...(onNow ? ['on-now'] : []), ...(mix ? ['mix'] : [])],
    // Saved: the first screen of an area people come back to. Not a searched patch of map, a bar's own, or a big page.
    meta: { persist: !barId && !searchedHere && !near && pageSize === PAGE },
    enabled: signedIn && enabled && (!searchedOnly || !!search),
    staleTime: 10 * 60 * 1000,
    placeholderData: (previous, previousQuery) =>
      previousQuery && (JSON.stringify(previousQuery.queryKey.slice(1, 3)) === JSON.stringify([where, barId]) || (searchedHere && previousQuery.queryKey[2] === null))
        ? previous
        : undefined,
    initialPageParam: null as ReturnType<typeof cursorAfter> | null,
    getNextPageParam: (last: ListPage) => (last.drinks.length < pageSize ? undefined : cursorAfter(last.drinks[last.drinks.length - 1])),
    queryFn: async ({ pageParam, signal }): Promise<ListPage> => {
      const params = { ...where, p_bar_id: barId, ...kinds, p_query: search || null, ...near, ...pageParam, p_limit: pageSize };
      const asked = { ...params, ...(onNow ? { p_on_now: true } : {}), ...(mix ? { p_mix: true } : {}) };
      const { data, error } = await supabase.rpc('discover_list', asked).abortSignal(signal);
      if (error) throw error;
      const rows = (data ?? []) as DrinkRow[];
      const first = rows[0];
      return { drinks: rows.map((r) => toDiscoverDrink(r, search)), totals: first && first.total_drinks !== null ? { drinks: first.total_drinks, bars: first.total_bars ?? 0 } : pageParam ? null : { drinks: 0, bars: 0 } };
    },
  });
  const pages = query.data?.pages;
  // "Not had yet" leaves out what you've had, from what's loaded (withoutHad).
  const had = useMyHadIds(!!filter.notHad);
  const hidden = filter.notHad ? had.data : undefined;
  const { drinks, totals } = useMemo(() => {
    const all = (pages ?? []).flatMap((p) => p.drinks);
    const firstTotals = pages?.[0]?.totals ?? null;
    return hidden ? withoutHad(all, firstTotals, hidden) : { drinks: all, totals: firstTotals };
  }, [pages, hidden]);
  return {
    drinks,
    totals,
    // Held (not enabled) reads as loading: Discover waits for location rather than show nothing.
    isLoading: signedIn && (query.isPending || (!!filter.notHad && had.isPending)),
    hasMore: !!query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    error: query.error,
  };
}

async function readBars(params: Record<string, unknown>, signal: AbortSignal): Promise<DiscoverBar[]> {
  // Anywhere is every public bar, past the 1,000-row cap (Black Pearl was bar 1,131 and search never saw it): a page at a time.
  // ponytail: each page reruns discover_bars over every bar in the area. Upgrade path: a p_after argument, which is a migration.
  const read = (p: Record<string, unknown>) =>
    allRowsById<BarRow>((after, size) => {
      let q = supabase.rpc('discover_bars', p);
      if (after) q = q.gt('id', after);
      return q.order('id').limit(size).abortSignal(signal);
    });
  return (await read(params)).map(toDiscoverBar);
}

/**
 * The public bars in an area, closed ones too, each with how many of its
 * drinks match the filters (none given: all its drinks): search finds bars
 * here, Filters lists the closed ones, and the area's pins come first.
 * `onNow`: also how many of those are on now ("14 drinks on now"), for search.
 */
export function useDiscoverBars(area: Area, filter: { kinds?: readonly string[]; search?: string; onNow?: boolean; searchedOnly?: boolean } = {}, enabled = true) {
  const signedIn = !!useAuth().user;
  const where = areaParams(area);
  const kinds = kindParams(filter.kinds ?? []);
  const search = searchKey(useDebounced(filter.search ?? '', 250));
  return useQuery({
    queryKey: ['discover-bars', where, kinds, search, ...(filter.onNow ? ['on-now'] : [])],
    // A searched patch of map isn't worth saving between launches; near me, a city and anywhere are.
    meta: { persist: !(area.kind === 'point' && area.source === 'map') },
    enabled: signedIn && enabled && (!filter.searchedOnly || !!search),
    staleTime: 60 * 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => readBars({ ...where, ...kinds, p_query: search || null, ...(filter.onNow ? { p_on_now: true } : {}) }, signal),
  });
}

/**
 * Discover's results for an area and filter: the first pages of drinks, the
 * area's bars, and its closed ones. Empty (not loading) when signed out.
 * `enabled` false holds the load (Discover waits for location); it reads as loading.
 * `onNow`: only the drinks on a menu now. `mix`: a bar at a time (browsing).
 */
export function useDiscoverResults(filter: DrinkFilter, enabled = true, onNow = false, mix = false) {
  useTrackSearch(filter.search, 'discover');
  const list = useDiscoverList(filter, { enabled, onNow, mix });
  const barsQuery = useDiscoverBars(filter.area, {}, enabled);
  const bars = barsQuery.data;
  const barsById = useMemo(() => new Map((bars ?? []).map((b) => [b.id, b])), [bars]);
  const closed = useMemo(() => closedBars(bars ?? [], filter.area), [bars, filter.area]);
  const more = { total: list.totals?.drinks ?? null, hasMore: list.hasMore, loadMore: list.loadMore, loading: list.isLoadingMore };
  return { ...list, more, bars: bars ?? [], barsById, closed };
}
