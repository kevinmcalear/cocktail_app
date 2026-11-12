import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/ctx/AuthContext';
import { useDiscoverRankings, useDrinkPick } from '@/hooks/useDiscover';
import { useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { parseHours, type WeekHours } from '@/lib/barHours';
import { closesLate, newMenus, onMenuRows, openNow, bestRows, type NewMenuSource } from '@/lib/discoverHome';
import { pickFilter, toDiscoverBar, type DiscoverBar } from '@/lib/discoverDrinks';
import { STYLES } from '@/lib/drinkStyles';
import { areaParams, type Area } from '@/lib/nearMe';
import type { MenuEditionDrink } from '@/lib/menuEditions';
import { jsonAs, supabase } from '@/lib/supabase';

/**
 * Bars the map draws and asks hours for: discover_bars' order (by id).
 * ponytail: "open" and "late" only know these 60, and a ranked bar past them counts as hours unknown. Upgrade: discover_bars returning hours.
 */
const MAP_BARS = 60;
/** The nearby bars whose menus New menus reads (one current_menus_of_bars call for all). */
const MENU_BARS = 8;
/** Ranked rows: three on phones (Prod-discover), four on the desktop (Prod-desk-discover). */
export const BEST_ROWS = { phone: 3, desk: 4 } as const;

type Hours = Record<string, { hours: WeekHours | null; timezone: string | null }>;

/** The bars' opening hours (profiles.hours, typed by each venue), by bar id. Plain JSON. */
function useBarHours(ids: readonly string[]) {
  const sorted = [...ids].sort();
  return useQuery({
    queryKey: ['bar-hours', sorted],
    enabled: sorted.length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Hours> => {
      const { data, error } = await supabase.from('profiles').select('id, hours, timezone').in('id', sorted);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, { hours: parseHours(p.hours), timezone: p.timezone }]));
    },
  });
}

/**
 * What time it is for open and late, one clock for the page so they don't
 * flicker as it renders. The tab stays mounted, so it moves on each return to
 * Discover and each return to the app.
 */
export function useOpenClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => setNow(new Date()), []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state === 'active' && setNow(new Date()));
    return () => sub.remove();
  }, []);
  return now;
}

export interface MapBar extends DiscoverBar {
  /** Open now, shut now, or not known. */
  open: boolean | null;
  late: boolean;
}

/**
 * The area's bars for the map card and the desktop map, each with whether
 * it's open now and open late tonight (from its hours). Closed-for-good bars
 * stay off. `total` counts them all, past the ones the map draws. `isLoading`
 * holds while Discover is still finding the person.
 */
export function useAreaBars(area: Area, locating: boolean, now: Date) {
  const signedIn = !!useAuth().user;
  const where = areaParams(area);
  // Only what the page shows: the first 60 open bars and how many there are, in one small request.
  // Search's whole list (useDiscoverBars) read every bar, a page of 1,000 at a time, before New menus could start (13 s cold).
  const query = useQuery({
    queryKey: ['discover-area-bars', where],
    meta: { persist: !(area.kind === 'point' && area.source === 'map') },
    enabled: signedIn && !locating,
    staleTime: 60 * 60 * 1000,
    // The last area's bars stay up while the next area's load, as search's list does.
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<{ bars: DiscoverBar[]; total: number }> => {
      const { data, count, error } = await supabase
        .rpc('discover_bars', where, { count: 'exact' })
        .eq('is_closed', false)
        .order('id')
        .limit(MAP_BARS)
        .abortSignal(signal);
      if (error) throw error;
      const bars = (data ?? []).map(toDiscoverBar);
      return { bars, total: count ?? bars.length };
    },
  });
  const bars = useMemo(() => query.data?.bars ?? [], [query.data]);
  const hours = useBarHours(bars.map((b) => b.id)).data;
  const withHours = useMemo<MapBar[]>(
    () =>
      bars.map((b) => {
        const h = hours?.[b.id];
        return { ...b, open: openNow(h?.hours, now, h?.timezone), late: closesLate(h?.hours, now, h?.timezone) };
      }),
    [bars, hours, now]
  );
  return { bars: withHours, total: query.data?.total ?? 0, isLoading: locating || (signedIn && query.isPending), error: query.error, refetch: query.refetch };
}

/**
 * "Best Martinis near you": the style's classic (its first, as Discover's
 * styles name it), the bars ranked for it in the area, each named after its
 * own drink of it, on a menu now. Every ranked row: the screen cuts the list.
 * `onMenus` when no bar there is ranked yet: the style's drinks on menus now.
 * Works for any style id in lib/drinkStyles STYLES that has a classic.
 */
export function useBestNear(area: Area, styleId: string, enabled: boolean) {
  const style = STYLES.find((s) => s.id === styleId) ?? STYLES[0];
  const classic = style.classics[0] ?? '';
  const found = useDrinkPick(classic);
  // useDrinkPick falls back to the best-known drink, which isn't this style's.
  const pick = found && found.name.toLowerCase() === classic.toLowerCase() ? found : null;
  const rankings = useDiscoverRankings(pick?.id, area, enabled);
  // ponytail: a bar's own drink is its first of the area's first 300 of the style, which may be a riff on the classic it's scored for; past 300 it shows the classic's name. Upgrade: discover_drink_rankings returning the drink.
  // Around a point the list comes nearest first, so the stand-in rows are the closest bars'.
  // ponytail: a city or anywhere comes in the list's own order (by name among equals). Upgrade: discover_list sorting by the bar's relevance.
  const from = useMemo(() => (area.kind === 'point' ? { latitude: area.latitude, longitude: area.longitude } : null), [area]);
  const drinks = useDiscoverList(pickFilter({ kinds: [], search: '', area }, classic), { enabled: enabled && !!pick, pageSize: 300, onNow: true, from });
  const rows = useMemo(() => bestRows(rankings.data?.ranked ?? [], drinks.drinks, pick?.name ?? classic), [rankings.data, drinks.drinks, pick, classic]);
  // Nobody ranked here yet: the same drinks stand in, one a bar, until a bar has its rankers.
  const onMenus = useMemo(() => (rows.length ? [] : onMenuRows(drinks.drinks)), [rows.length, drinks.drinks]);
  const waiting = rankings.isPending || (!rows.length && !rankings.error && drinks.isLoading);
  return { style, classic, classicId: pick?.id ?? null, rows, onMenus, isLoading: enabled && !!pick && waiting, error: rankings.error, refetch: rankings.refetch };
}

/** New menus: what's on now at the nearest bars, newest first. One call for all of them. */
export function useNewMenus(bars: readonly DiscoverBar[], now: Date) {
  const near = bars.slice(0, MENU_BARS);
  const ids = near.map((b) => b.id).sort();
  const query = useQuery({
    queryKey: ['new-menus', ids],
    enabled: ids.length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Record<string, NewMenuSource[]>> => {
      const { data, error } = await supabase.rpc('current_menus_of_bars', { p_profile_ids: ids });
      if (error) throw error;
      const byBar: Record<string, NewMenuSource[]> = {};
      for (const m of data ?? []) (byBar[m.profile_id] ??= []).push({ id: m.id, name: m.name, year: m.year, month: m.month, is_current: true, drinks: jsonAs<MenuEditionDrink[]>(m.drinks) });
      return byBar;
    },
  });
  // A few bars' menus: cheap enough to sort on each render.
  const menus = newMenus(near.map((b) => ({ barId: b.id, barName: b.name, editions: query.data?.[b.id] ?? [] })), now);
  return { menus, isLoading: ids.length > 0 && query.isPending };
}
