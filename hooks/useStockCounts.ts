import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { OnHandRow } from '@/lib/stock';
import { supabase } from '@/lib/supabase';

/** The latest count at each spot (stock_on_hand). Empty below the locations capability. */
export function useStockOnHand(barId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['stock-on-hand', barId],
    enabled: !!barId && enabled,
    queryFn: async (): Promise<OnHandRow[]> => {
      const { data, error } = await supabase.rpc('stock_on_hand', { p_bar: barId! });
      if (error) throw error;
      return (data ?? []) as OnHandRow[];
    },
  });
}

export interface CountLineInput {
  item_id: string;
  location_id: string | null;
  amount: number;
  unit: string;
}

/** Save one zone's count: the count row, then its lines. */
export function useSaveZoneCount(barId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ zoneId, lines, note }: { zoneId: string | null; lines: CountLineInput[]; note?: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: count, error } = await supabase
        .from('stock_counts')
        .insert({ bar_id: barId, zone_id: zoneId, note: note ?? null, counted_by: userData.user?.id })
        .select('id')
        .single();
      if (error) throw error;
      if (lines.length) {
        const { error: lineError } = await supabase.from('stock_count_lines').insert(lines.map((l) => ({ ...l, count_id: count.id })));
        if (lineError) throw lineError;
      }
      return count.id as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stock-on-hand', barId] });
      void queryClient.invalidateQueries({ queryKey: ['prep-data'] });
    },
  });
}
