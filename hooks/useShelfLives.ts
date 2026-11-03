import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// Its own file: the batch sheet and Drinks' House-made read it without the rest of batches or batch prep.

/** How long each of these house preps keeps (item_prep.shelf_life_hours), by id. Plain JSON. */
export function useShelfLives(itemIds: readonly string[]) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['shelf-lives', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from('item_prep').select('item_id, shelf_life_hours').in('item_id', ids);
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as { item_id: string; shelf_life_hours: number | null }[]).filter((r) => r.shelf_life_hours).map((r) => [r.item_id, r.shelf_life_hours!]));
    },
  });
}
