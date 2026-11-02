import { useQueries, useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/ctx/AuthContext';
import { useDiscoverRankings, useDrinkPick } from '@/hooks/useDiscover';
import { useDiscoverBars, useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { menuEditionsQuery } from '@/hooks/useMenuRuns';
import { parseHours, type WeekHours } from '@/lib/barHours';
import { closesLate, newMenus, openNow, bestRows } from '@/lib/discoverHome';
import { pickFilter, type DiscoverBar } from '@/lib/discoverDrinks';
import { STYLES } from '@/lib/drinkStyles';
import type { Area } from '@/lib/nearMe';
import { supabase } from '@/lib/supabase';

/**
 * Bars the map draws and asks hours for: discover_bars' order, most relevant first.
 * ponytail: "open" and "late" only know these 60, and a ranked bar past them counts as hours unknown. Upgrade: discover_bars returning hours.
 */
const MAP_BARS = 60;
/** The nearby bars whose menus New menus reads (a get_menu_editions call each, shared with their pages). */
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
  const query = useDiscoverBars(area, {}, !locating);
  const open = useMemo(() => (query.data ?? []).filter((b) => !b.closed), [query.data]);
  const bars = useMemo(() => open.slice(0, MAP_BARS), [open]);
  const hours = useBarHours(bars.map((b) => b.id)).data;
  const withHours = useMemo<MapBar[]>(
    () =>
      bars.map((b) => {
        const h = hours?.[b.id];
        return { ...b, open: openNow(h?.hours, now, h?.timezone), late: closesLate(h?.hours, now, h?.timezone) };
      }),
    [bars, hours, now]
  );
  const signedIn = !!useAuth().user;
  return { bars: withHours, total: open.length, isLoading: locating || (signedIn && query.isPending), error: query.error, refetch: query.refetch };
}

/**
 * "Best Martinis near you": the style's classic (its first, as Discover's
 * styles name it), the bars ranked for it in the area, each named after its
 * own drink of it, on a menu now. Every ranked row: the screen cuts the list.
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
  const drinks = useDiscoverList(pickFilter({ kinds: [], search: '', area }, classic), { enabled: enabled && !!pick, pageSize: 300, onNow: true });
  const rows = useMemo(() => bestRows(rankings.data?.ranked ?? [], drinks.drinks, pick?.name ?? classic), [rankings.data, drinks.drinks, pick, classic]);
  return { style, classicId: pick?.id ?? null, rows, isLoading: enabled && !!pick && rankings.isPending, error: rankings.error, refetch: rankings.refetch };
}

/** New menus: what's on now at the nearest bars, newest first. */
export function useNewMenus(bars: readonly DiscoverBar[], now: Date) {
  const near = bars.slice(0, MENU_BARS);
  const results = useQueries({ queries: near.map((b) => ({ ...menuEditionsQuery(b.id), staleTime: 60 * 60 * 1000 })) });
  // A few bars' menus: cheap enough to sort on each render.
  const menus = newMenus(near.map((b, i) => ({ barId: b.id, barName: b.name, editions: results[i]?.data ?? [] })), now);
  return { menus, isLoading: results.some((r) => r.isPending) };
}
