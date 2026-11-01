import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

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

/** Bars the map card draws and asks hours for: discover_bars' order, most relevant first. */
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

export interface MapBar extends DiscoverBar {
  /** Open now, shut now, or not known. */
  open: boolean | null;
  late: boolean;
}

/**
 * The area's bars for the map card and the desktop map, each with whether
 * it's open now and open late tonight (from its hours). Closed-for-good bars
 * stay off. `isLoading` holds while Discover is still finding the person.
 */
export function useAreaBars(area: Area, locating: boolean) {
  const query = useDiscoverBars(area, {}, !locating);
  const bars = useMemo(() => (query.data ?? []).filter((b) => !b.closed).slice(0, MAP_BARS), [query.data]);
  const hours = useBarHours(bars.map((b) => b.id)).data;
  // One clock for the page, so open and late don't flicker as it renders.
  const [now] = useState(() => new Date());
  const withHours = useMemo<MapBar[]>(
    () =>
      bars.map((b) => {
        const h = hours?.[b.id];
        return { ...b, open: openNow(h?.hours, now, h?.timezone), late: closesLate(h?.hours, now, h?.timezone) };
      }),
    [bars, hours, now]
  );
  const signedIn = !!useAuth().user;
  return { bars: withHours, isLoading: locating || (signedIn && query.isPending), error: query.error, refetch: query.refetch };
}

/**
 * "Best Martinis near you": the style's classic (its first, as Discover's
 * styles name it), the bars ranked for it in the area, each named after its
 * own drink of it. Works for any style id in lib/drinkStyles STYLES.
 */
export function useBestNear(area: Area, styleId: string, enabled: boolean) {
  const style = STYLES.find((s) => s.id === styleId) ?? STYLES[0];
  const classic = style.classics[0] ?? '';
  const pick = useDrinkPick(classic);
  const rankings = useDiscoverRankings(pick?.id, area, enabled);
  // ponytail: the bar's own drink comes from the area's first 300 of the classic's drinks; a bar past that shows the classic's name. Upgrade: discover_drink_rankings returning the drink.
  const drinks = useDiscoverList(pickFilter({ kinds: [], search: '', area }, classic), { enabled: enabled && !!pick, pageSize: 300 });
  const rows = useMemo(() => bestRows(rankings.data?.ranked ?? [], drinks.drinks, pick?.name ?? classic, BEST_ROWS.desk), [rankings.data, drinks.drinks, pick, classic]);
  return { style, classicId: pick?.id ?? null, rows, isLoading: enabled && !!pick && rankings.isPending, error: rankings.error };
}

/** New menus: what's on now at the nearest bars, newest first. */
export function useNewMenus(bars: readonly DiscoverBar[]) {
  const near = bars.slice(0, MENU_BARS);
  const results = useQueries({ queries: near.map((b) => ({ ...menuEditionsQuery(b.id), staleTime: 60 * 60 * 1000 })) });
  const [now] = useState(() => new Date());
  // A few bars' menus: cheap enough to sort on each render.
  const menus = newMenus(near.map((b, i) => ({ barId: b.id, barName: b.name, editions: results[i]?.data ?? [] })), now);
  return { menus, isLoading: results.some((r) => r.isPending) };
}
