// A bar's whole repertoire ("Our drinks", canvas Menu-l-drinks): its drinks
// with their dates on the bar's lists (drink_list_dates), split by
// lib/repertoire into on now, past (Bring back) and never on a list.
import { useQuery } from '@tanstack/react-query';

import { useMenuLibrary } from '@/hooks/useMenuMutations';
import { repertoire, type ListDates } from '@/lib/repertoire';
import { supabase } from '@/lib/supabase';

/** Dates on a list for these drinks, at any bar that listed them (a bar's own drinks are rarely anywhere else). */
function useListDates(itemIds: string[]) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['drink-list-dates', ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<ListDates[]> => {
      // ponytail: one call for every drink; a bar with thousands of drinks (a daily-list pool) pages this by 500.
      const { data, error } = await supabase.rpc('drink_list_dates', { p_item_ids: ids });
      if (error) throw error;
      return (data ?? []).map((r) => ({ itemId: r.item_id, listName: r.edition_name, startsOn: r.starts_on, endsOn: r.ends_on, isCurrent: r.is_current }));
    },
  });
}

export function useRepertoire(barId: string | null | undefined) {
  const library = useMenuLibrary(barId, !!barId);
  const drinks = library.data ?? [];
  const dates = useListDates(drinks.map((d) => d.id));
  return {
    isLoading: library.isLoading || dates.isLoading,
    error: library.error ?? dates.error,
    ...repertoire(drinks, dates.data ?? []),
  };
}
