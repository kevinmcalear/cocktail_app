import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { useDebounced } from '@/hooks/useDiscover';
import { useTrackSearch } from '@/hooks/useTrackSearch';
import { filterDrinks, toDiscoverDrink, type DiscoverBar, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';
import { menuOrder, runDates, searchMenuTag } from '@/lib/menuEditions';
import { areaParams, type Area } from '@/lib/nearMe';
import { supabase } from '@/lib/supabase';

/** PostgREST's row cap, and discover_drinks' largest page. */
const PAGE = 1000;

/**
 * "Anywhere" in eight id ranges loaded side by side, each about 900 drinks:
 * the whole set in about the time of one page. Bounds are exclusive.
 */
const STARTS = ['0', '2', '4', '6', '8', 'a', 'c', 'e'];
const RANGES = STARTS.map((hex, i): [string | null, string | null] => [
  i === 0 ? null : `${(parseInt(hex, 16) - 1).toString(16)}fffffff-ffff-ffff-ffff-ffffffffffff`,
  i === STARTS.length - 1 ? null : `${STARTS[i + 1]}0000000-0000-0000-0000-000000000000`,
]);

/** A row of discover_drinks (supabase/migrations/20261008330000_discover_drinks_rpc.sql). */
interface DrinkRow {
  id: string;
  name: string;
  description: string | null;
  riff_of: string | null;
  ingredients: string[];
  image_url: string | null;
  bar_profile_id: string;
  /** [start year, start month, end year, end month, 1 if on now], or null when never on a menu. */
  menu_run: [number, number | null, number | null, number | null, number] | null;
  notes: string[];
}

type Signal = AbortSignal | undefined;

interface DiscoverData {
  drinks: DiscoverDrink[];
  bars: DiscoverBar[];
}

const ANYWHERE: Area = { kind: 'anywhere' };

/**
 * The bars in an area and the drinks they pour, with their styles and
 * spirits: what Discover searches, filters and pins on the map. Read through
 * discover_drinks, so the area (and, everywhere, a typed search) is applied
 * in SQL: near me is one request of a few hundred drinks. Anywhere with no
 * search is still every bar drink (the eight ball and the "anywhere" list
 * need them all), in compact rows loaded side by side. Signed-in only, like
 * every shared drink.
 */
export function useDiscoverDrinks(area: Area = ANYWHERE, search = '', enabled = true) {
  const signedIn = !!useAuth().user;
  const where = areaParams(area);
  return useQuery<DiscoverData>({
    queryKey: ['discover-drinks', where, search],
    // Anywhere is too big to save between launches (lib/queryCachePersist.ts), and areas change as the map moves.
    meta: { persist: false },
    enabled: signedIn && enabled,
    staleTime: 30 * 60 * 1000,
    // A new search in the same area keeps the last results up while it loads; a new area doesn't, so the map refits.
    placeholderData: (previous, previousQuery) =>
      previousQuery && JSON.stringify(previousQuery.queryKey[1]) === JSON.stringify(where) ? previous : undefined,
    queryFn: async ({ signal }): Promise<DiscoverData> => {
      const ranges = area.kind === 'anywhere' && !search ? RANGES : [[null, null] as [null, null]];
      const [bars, ...pages] = await Promise.all([readBars(area, signal), ...ranges.map(([after, before]) => readDrinks(where, search, after, before, signal))]);
      const drinks = pages.flat().map((r) =>
        toDiscoverDrink({
          id: r.id,
          name: r.name,
          description: r.description,
          riffOf: r.riff_of,
          ingredients: r.ingredients,
          imageUrl: r.image_url,
          barId: r.bar_profile_id,
          menu: menuOf(r),
          notes: r.notes,
        })
      );
      return { drinks, bars };
    },
  });
}

/** One id range of discover_drinks, a page at a time (keyset on id). */
async function readDrinks(where: Record<string, string | number>, search: string, after: string | null, before: string | null, signal: Signal): Promise<DrinkRow[]> {
  const rows: DrinkRow[] = [];
  for (;;) {
    const last = rows.length ? rows[rows.length - 1].id : after;
    const { data, error } = await supabase
      .rpc('discover_drinks', { ...where, p_query: search || null, p_after: last, p_before: before, p_limit: PAGE })
      .abortSignal(signal as AbortSignal);
    if (error) throw error;
    rows.push(...((data ?? []) as DrinkRow[]));
    if ((data ?? []).length < PAGE) return rows;
  }
}

/**
 * The public, open bars in the area: the map's pins and the bars search
 * finds, including ones with no drinks listed. A box around a point (the
 * exact distance is checked on the device, lib/discoverDrinks.ts barInArea).
 */
async function readBars(area: Area, signal: Signal): Promise<DiscoverBar[]> {
  let query = supabase
    .from('profiles')
    .select('id, handle, display_name, avatar_url, locality, city, country_code, latitude, longitude')
    .eq('kind', 'bar')
    .eq('is_public', true)
    .eq('is_closed', false);
  if (area.kind === 'point') {
    const dLat = area.radiusKm / 111.045;
    const dLng = area.radiusKm / (111.045 * Math.max(Math.cos((area.latitude * Math.PI) / 180), 0.01));
    query = query.gte('latitude', area.latitude - dLat).lte('latitude', area.latitude + dLat);
    // ponytail: no longitude bound across the antimeridian; the device check still applies.
    if (Math.abs(area.longitude) + dLng < 180) query = query.gte('longitude', area.longitude - dLng).lte('longitude', area.longitude + dLng);
  } else if (area.kind === 'city') {
    query = query.eq('country_code', area.country_code.toUpperCase()).ilike('city', area.city.replace(/[\\%_]/g, '\\$&'));
  }
  // About 500 public bars in all, under one page.
  const { data, error } = await query.order('id').limit(PAGE).abortSignal(signal as AbortSignal);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    handle: p.handle,
    name: p.display_name,
    logo: p.avatar_url,
    locality: p.locality,
    city: p.city,
    countryCode: p.country_code,
    latitude: p.latitude,
    longitude: p.longitude,
  }));
}

/** Plain JSON for the query cache: on now, or past with its dates, and where it sorts. */
function menuOf({ menu_run: run }: DrinkRow): DiscoverDrink['menu'] {
  const dates = run ? runDates({ start_year: run[0], start_month: run[1], end_year: run[2], end_month: run[3], is_current: run[4] === 1 }) : null;
  const tag = searchMenuTag(dates);
  return { onNow: !!tag?.onNow, past: tag?.past ?? null, order: menuOrder(dates) };
}

const ALL_KEY = ['discover-drinks', areaParams(ANYWHERE), ''];

/**
 * The drinks at bars that match Discover's filter, and the bars behind them.
 * Empty (not loading) when signed out: shared drinks need an account.
 * Searching everywhere asks the server, unless every drink is already here.
 * `enabled` false holds the load (Discover waits for location before
 * loading everything); it reads as loading.
 */
export function useDiscoverResults(filter: DrinkFilter, enabled = true) {
  const signedIn = !!useAuth().user;
  const haveAll = !!useQueryClient().getQueryData(ALL_KEY);
  const typed = useDebounced(filter.search.trim(), 250);
  const search = filter.area.kind === 'anywhere' && !haveAll ? typed : '';
  const query = useDiscoverDrinks(filter.area, search, enabled);
  useTrackSearch(filter.search, 'discover');
  const bars = query.data?.bars ?? [];
  const barsById = new Map(bars.map((b) => [b.id, b]));
  const drinks = query.data ? filterDrinks(query.data.drinks, barsById, filter) : [];
  return { drinks, bars, barsById, isLoading: signedIn && query.isPending, error: query.error };
}
