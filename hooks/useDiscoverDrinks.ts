import { keepPreviousData, useInfiniteQuery, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { useDebounced } from '@/hooks/useDiscover';
import { useTrackSearch } from '@/hooks/useTrackSearch';
import { foldName } from '@/lib/discover';
import { closedBars, cursorAfter, kindParams, toDiscoverBar, toDiscoverDrink, type BarRow, type DiscoverBar, type DiscoverDrink, type DrinkFilter, type DrinkRow } from '@/lib/discoverDrinks';
import type { Viewport } from '@/lib/discoverMap';
import { inBox, parentTiles, tileBox, tilesFor, type Tile } from '@/lib/discoverTiles';
import { areaParams, type Area } from '@/lib/nearMe';
import { supabase } from '@/lib/supabase';

/**
 * Discover's data, a page at a time (supabase/migrations/20261009500000_discover_index.sql):
 * the matching drinks in an area best first (discover_list), the bars in an
 * area (discover_bars), and the bars in the map's view a tile at a time. The
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
export function useDiscoverList(filter: DrinkFilter, { barId = null, enabled = true, pageSize = PAGE }: ListOptions = {}) {
  const signedIn = !!useAuth().user;
  const search = searchKey(useDebounced(filter.search, 250));
  const where = barId ? {} : areaParams(filter.area);
  const kinds = kindParams(filter.kinds);
  const query = useInfiniteQuery({
    queryKey: ['discover-list', where, barId, kinds, search, pageSize],
    meta: { persist: true },
    enabled: signedIn && enabled,
    staleTime: 10 * 60 * 1000,
    placeholderData: (previous, previousQuery) =>
      previousQuery && JSON.stringify(previousQuery.queryKey.slice(1, 3)) === JSON.stringify([where, barId]) ? previous : undefined,
    initialPageParam: null as ReturnType<typeof cursorAfter> | null,
    getNextPageParam: (last: ListPage) => (last.drinks.length < pageSize ? undefined : cursorAfter(last.drinks[last.drinks.length - 1])),
    queryFn: async ({ pageParam, signal }): Promise<ListPage> => {
      const { data, error } = await supabase
        .rpc('discover_list', { ...where, p_bar_id: barId, ...kinds, p_query: search || null, ...pageParam, p_limit: pageSize })
        .abortSignal(signal);
      if (error) throw error;
      const rows = (data ?? []) as DrinkRow[];
      const first = rows[0];
      return { drinks: rows.map(toDiscoverDrink), totals: first && first.total_drinks !== null ? { drinks: first.total_drinks, bars: first.total_bars ?? 0 } : pageParam ? null : { drinks: 0, bars: 0 } };
    },
  });
  const pages = query.data?.pages;
  const drinks = useMemo(() => (pages ?? []).flatMap((p) => p.drinks), [pages]);
  return {
    drinks,
    totals: pages?.[0]?.totals ?? null,
    // Held (not enabled) reads as loading: Discover waits for location rather than show nothing.
    isLoading: signedIn && query.isPending,
    hasMore: !!query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    error: query.error,
  };
}

async function readBars(params: Record<string, unknown>, signal: AbortSignal): Promise<DiscoverBar[]> {
  const { data, error } = await supabase.rpc('discover_bars', params).abortSignal(signal);
  if (error) throw error;
  return ((data ?? []) as BarRow[]).map(toDiscoverBar);
}

/**
 * The public bars in an area, closed ones too, each with how many of its
 * drinks match the filters (none given: all its drinks): search finds bars
 * here, Filters lists the closed ones, and the area's pins come first.
 */
export function useDiscoverBars(area: Area, filter: { kinds?: readonly string[]; search?: string } = {}, enabled = true) {
  const signedIn = !!useAuth().user;
  const where = areaParams(area);
  const kinds = kindParams(filter.kinds ?? []);
  const search = searchKey(useDebounced(filter.search ?? '', 250));
  return useQuery({
    queryKey: ['discover-bars', where, kinds, search],
    meta: { persist: true },
    enabled: signedIn && enabled,
    staleTime: 60 * 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => readBars({ ...where, ...kinds, p_query: search || null }, signal),
  });
}

const tileQueryKey = (t: Tile, kinds: ReturnType<typeof kindParams>, search: string) => ['discover-tile', t.z, t.x, t.y, kinds, search] as const;

/** A coarser tile already loaded with the same filters answers for this one, so zooming in never asks again. */
function fromParent(client: QueryClient, t: Tile, kinds: ReturnType<typeof kindParams>, search: string): DiscoverBar[] | undefined {
  const box = tileBox(t);
  for (const p of parentTiles(t)) {
    const bars = client.getQueryData<DiscoverBar[]>(tileQueryKey(p, kinds, search));
    if (bars) return bars.filter((b) => inBox(b, box));
  }
  return undefined;
}

/**
 * The bars in what the map shows, a tile at a time: the tile under the
 * middle first, the rest once it's in. Tiles are kept and saved, so panning
 * back or zooming in reuses them; zooming out loads coarser ones. Nothing
 * while `viewport` is null (the map shows the area, which useDiscoverBars has).
 */
export function useTileBars(viewport: Viewport | null, filter: { kinds: readonly string[]; search: string }, enabled = true) {
  const signedIn = !!useAuth().user;
  const client = useQueryClient();
  const kinds = kindParams(filter.kinds);
  const search = searchKey(useDebounced(filter.search, 250));
  const tiles = useMemo(() => (viewport ? tilesFor(viewport) : []), [viewport]);
  const results = useQueries({
    queries: tiles.map((t, i) => ({
      queryKey: tileQueryKey(t, kinds, search),
      meta: { persist: true },
      // The middle tile first: the rest wait for it, so what's under the person's eye lands soonest.
      enabled: signedIn && enabled && (i === 0 || !!client.getQueryData(tileQueryKey(tiles[0], kinds, search))),
      staleTime: 60 * 60 * 1000,
      initialData: () => fromParent(client, t, kinds, search),
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        const box = tileBox(t);
        return readBars({ p_west: box.west, p_south: box.south, p_east: box.east, p_north: box.north, ...kinds, p_query: search || null }, signal);
      },
    })),
  });
  return { bars: results.flatMap((r) => r.data ?? []), isLoading: results.some((r) => r.isPending && r.fetchStatus !== 'idle') };
}

/**
 * Discover's results for an area and filter: the first pages of drinks, the
 * area's bars, and its closed ones. Empty (not loading) when signed out.
 * `enabled` false holds the load (Discover waits for location); it reads as loading.
 */
export function useDiscoverResults(filter: DrinkFilter, enabled = true) {
  useTrackSearch(filter.search, 'discover');
  const list = useDiscoverList(filter, { enabled });
  const barsQuery = useDiscoverBars(filter.area, {}, enabled);
  const bars = barsQuery.data;
  const barsById = useMemo(() => new Map((bars ?? []).map((b) => [b.id, b])), [bars]);
  const closed = useMemo(() => closedBars(bars ?? [], filter.area), [bars, filter.area]);
  const more = { total: list.totals?.drinks ?? null, hasMore: list.hasMore, loadMore: list.loadMore, loading: list.isLoadingMore };
  return { ...list, more, bars: bars ?? [], barsById, closed };
}
