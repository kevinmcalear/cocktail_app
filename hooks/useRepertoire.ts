// A bar's whole repertoire ("Our drinks", canvas Menu-l-drinks): every drink
// that has been on one of its lists, its own or a classic, with its dates on
// the bar's lists (drink_list_dates), split by lib/repertoire into on now and
// past (Bring back).
import { useQuery } from '@tanstack/react-query';

import { MENU_DRINK_COLUMNS, toMenuDrink, type MenuItemRow } from '@/hooks/useMenus';
import { allRows } from '@/lib/allRows';
import { repertoire, type ListDates } from '@/lib/repertoire';
import { supabase } from '@/lib/supabase';
import type { MenuDrink } from '@/types/menus';

const CHUNK = 300;

/** Every drink on one of the bar's lists, now or before (taken off: menu_drinks_removed), and the bar's own page, which dates them. */
function useBarListDrinks(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['bar-list-drinks', barId],
    enabled: !!barId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ drinks: MenuDrink[]; profileId: string | null }> => {
      const [on, off, profile] = await Promise.all([
        allRows((from, to) => supabase.from('menu_drinks').select('item_id, menu:menus!inner(bar_id)').eq('menu.bar_id', barId!).not('item_id', 'is', null).order('id').range(from, to)),
        allRows((from, to) => supabase.from('menu_drinks_removed').select('item_id, menu:menus!inner(bar_id)').eq('menu.bar_id', barId!).order('id').range(from, to)),
        supabase.from('profiles').select('id').eq('bar_id', barId!).eq('kind', 'bar').limit(1).maybeSingle(),
      ]);
      if (profile.error) throw profile.error;
      const ids = [...new Set([...on, ...off].map((r) => r.item_id).filter((id): id is string => !!id))];
      const rows: MenuItemRow[] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data, error } = await supabase.from('items').select(MENU_DRINK_COLUMNS).in('id', ids.slice(i, i + CHUNK));
        if (error) throw error;
        rows.push(...((data ?? []) as unknown as MenuItemRow[]));
      }
      return { drinks: rows.map((r) => toMenuDrink(r)).filter((d): d is MenuDrink => !!d), profileId: profile.data?.id ?? null };
    },
  });
}

/** Dates on the bar's own lists for these drinks (a classic is on other bars' lists too). */
function useListDates(itemIds: string[], profileId: string | null) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['drink-list-dates', ids, profileId],
    enabled: ids.length > 0 && !!profileId,
    staleTime: 60_000,
    queryFn: async (): Promise<ListDates[]> => {
      // ponytail: one call for every drink; a bar with thousands of drinks (a daily-list pool) pages this by 500.
      const { data, error } = await supabase.rpc('drink_list_dates', { p_item_ids: ids });
      if (error) throw error;
      return (data ?? [])
        .filter((r) => r.profile_id === profileId)
        .map((r) => ({
          itemId: r.item_id,
          listName: r.edition_name,
          startsOn: r.starts_on,
          endsOn: r.ends_on,
          startYear: r.start_year,
          startMonth: r.start_month,
          endYear: r.end_year,
          endMonth: r.end_month,
          isCurrent: r.is_current,
        }));
    },
  });
}

export function useRepertoire(barId: string | null | undefined) {
  const list = useBarListDrinks(barId);
  const drinks = list.data?.drinks ?? [];
  const dates = useListDates(
    drinks.map((d) => d.id),
    list.data?.profileId ?? null,
  );
  return {
    isLoading: list.isLoading || dates.isLoading,
    error: list.error ?? dates.error,
    ...repertoire(drinks, dates.data ?? []),
  };
}
