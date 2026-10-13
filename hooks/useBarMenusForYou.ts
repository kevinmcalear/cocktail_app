import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { fetchPublished } from '@/hooks/usePublished';
import { editionDates, type MenuEdition } from '@/lib/menuEditions';
import type { ForYouEdition, ListPlace } from '@/lib/collectionMenus';
import { supabase } from '@/lib/supabase';

/** A bar's menu for Collection's "Bar menus for you", with what the card shows. Plain JSON. */
export interface BarMenuForYou extends ForYouEdition {
  theme: string | null;
  barHandle: string | null;
  barAvatarUrl: string | null;
  barPlace: string | null;
  /** Its drinks in menu order, with a line for each: what's in it, as the bar describes it. */
  drinks: { id: string; name: string; line: string | null }[];
}

type EditionCols = Pick<MenuEdition, 'id' | 'name' | 'year' | 'month' | 'end_year' | 'end_month' | 'is_current' | 'theme'>;
interface EditionRow extends EditionCols {
  profile: { id: string; handle: string | null; display_name: string; avatar_url: string | null; locality: string | null; city: string | null } | null;
  drinks: { item_id: string; sort_order: number | null }[] | null;
}

/**
 * The menus of the bars you had drinks at (`barIds`, their profile ids),
 * newest first, for lib/collectionMenus barMenuPicks to choose from. Public
 * data: editions and published drinks.
 */
export function useBarMenusForYou(barIds: readonly string[], { currentOnly = false }: { currentOnly?: boolean } = {}) {
  const userId = useUserId();
  const ids = [...new Set(barIds)].sort();
  return useQuery({
    queryKey: ['bar-menus-for-you', userId, ids, currentOnly],
    enabled: !!userId && ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<BarMenuForYou[]> => {
      // ponytail: every menu of every bar you ranked at, in one page. People
      // rank at a few dozen bars; cap by year if that ever grows past a page.
      let query = supabase
        .from('profile_menu_editions')
        .select('id, name, year, month, end_year, end_month, is_current, theme, profile:profiles!profile_id(id, handle, display_name, avatar_url, locality, city), drinks:profile_menu_edition_drinks(item_id, sort_order)')
        .in('profile_id', ids);
      // The 50 Best fallback wants only what's on now, and its drinks' ids must fit in one request.
      if (currentOnly) query = query.eq('is_current', true);
      const { data, error } = await query
        .order('year', { ascending: false })
        .order('month', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const rows = ((data ?? []) as unknown as EditionRow[]).filter((r) => r.profile);
      const itemIds = [...new Set(rows.flatMap((r) => (r.drinks ?? []).map((d) => d.item_id)))];
      const published = await fetchPublished(itemIds);
      return rows.map((r) => {
        const order = [...(r.drinks ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((d) => d.item_id);
        const p = r.profile!;
        return {
          id: r.id,
          name: r.name,
          theme: r.theme,
          barId: p.id,
          barName: p.display_name,
          barHandle: p.handle,
          barAvatarUrl: p.avatar_url,
          barPlace: p.city || p.locality,
          dates: editionDates(r),
          drinkIds: order,
          drinks: order.flatMap((id) => {
            const d = published.find((x) => x.id === id);
            return d ? [{ id, name: d.name, line: d.description }] : [];
          }),
        };
      });
    },
  });
}

/** How many of the list's best placed bars the fallback reads: a featured card and a rail of six, with room for bars with no menu on. */
export const FIFTY_BEST_READ = 12;

/** The list Bar menus for you falls back on before you've ranked anything. */
export const FIFTY_BEST = 'The World\'s 50 Best Bars';

/**
 * The bars on the latest World's 50 Best Bars list, best placed first, for
 * Bar menus for you while you haven't ranked a drink at a bar (`enabled`).
 * Public data. Plain JSON.
 */
export function useFiftyBest(enabled: boolean) {
  return useQuery({
    queryKey: ['fifty-best-places'],
    enabled,
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<ListPlace[]> => {
      const { data, error } = await supabase
        .from('profile_awards')
        .select('profile_id, position, year')
        .eq('award', FIFTY_BEST)
        .eq('status', 'confirmed')
        .not('position', 'is', null)
        .order('year', { ascending: false })
        .order('position', { ascending: true })
        .limit(100);
      if (error) throw error;
      const latest = data?.[0]?.year;
      return (data ?? []).filter((r) => r.year === latest).map((r) => ({ barId: r.profile_id, position: r.position ?? 0, award: FIFTY_BEST, year: r.year }));
    },
  });
}
