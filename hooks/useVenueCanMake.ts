import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { byDrink, type VenueCanMake } from '@/lib/venueCanMake';

/** venue_can_make answers at most this many drinks a call. */
const PAGE = 100;

/**
 * Whether the venue's back bar makes each drink on a page of results
 * (venue_can_make): can make, or what's missing. Staff of that venue only; no
 * venue (at home) asks nothing. A drink whose spec the caller can't read has
 * no entry.
 */
export function useVenueCanMake(venueId: string | null | undefined, drinkIds: readonly string[]) {
  const ids = [...new Set(drinkIds)].sort();
  return useQuery({
    queryKey: ['venue-can-make', venueId, ids],
    enabled: !!venueId && ids.length > 0,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Record<string, VenueCanMake>> => {
      const pages = [];
      for (let i = 0; i < ids.length; i += PAGE) pages.push(ids.slice(i, i + PAGE));
      const answers = await Promise.all(
        pages.map(async (page) => {
          const { data, error } = await supabase.rpc('venue_can_make', { p_bar_id: venueId!, p_drink_ids: page });
          if (error) throw error;
          return byDrink(data ?? []);
        })
      );
      return Object.assign({}, ...answers);
    },
  });
}
