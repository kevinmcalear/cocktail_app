import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { showMessage } from '@/lib/dialogs';
import { supabase } from '@/lib/supabase';
import type { BarStock } from '@/types/backBar';

const stockKey = (barId: string | null | undefined) => ['bar-stock', barId];
const STOCK_COLUMNS = 'item_id, added_from, added_at, item:items!item_id(id, name)';

/**
 * The bottles the venue stocks, with or without a spot on the plan, newest
 * first. Its staff read it; a spot in item_locations also counts as stocked.
 */
export function useBarStock(barId: string | null | undefined) {
  return useQuery({
    queryKey: stockKey(barId),
    enabled: !!barId,
    queryFn: async (): Promise<BarStock[]> => {
      const { data, error } = await supabase.from('bar_stock').select(STOCK_COLUMNS).eq('bar_id', barId!).order('added_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BarStock[];
    },
  });
}

interface StockChange {
  item: { id: string; name: string };
  on: boolean;
  /** The drink it's put on from, by name ("Ash Garden"). */
  from?: string | null;
}

/**
 * Put a bottle on the venue's back bar, or take it off. The icon switches at
 * once; writes go one at a time, in order, so a tap and its Undo land in the
 * order they were made. Drink Creators and up, and roles with `prep`.
 */
export function useStockToggle(barId: string | null | undefined) {
  const qc = useQueryClient();
  const key = stockKey(barId);
  return useMutation({
    scope: { id: `bar-stock-${barId}` },
    mutationFn: async ({ item, on, from }: StockChange) => {
      if (on) {
        const { error } = await supabase.from('bar_stock').insert({ bar_id: barId!, item_id: item.id, added_from: from?.trim().slice(0, 120) || null });
        // 23505: already on it (another device got there first), which is what was asked.
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase.from('bar_stock').delete().eq('bar_id', barId!).eq('item_id', item.id);
        if (error) throw error;
      }
    },
    onMutate: async ({ item, on, from }) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<BarStock[]>(key);
      const rest = (before ?? []).filter((r) => r.item_id !== item.id);
      qc.setQueryData<BarStock[]>(key, on ? [{ item_id: item.id, added_from: from ?? null, added_at: new Date().toISOString(), item }, ...rest] : rest);
      return { before };
    },
    onError: (error, _change, ctx) => {
      qc.setQueryData(key, ctx?.before);
      showMessage('That didn’t save', `${error.message}. Check your connection and try again.`);
    },
    // Not awaited: the next tap (or Undo) waits only for this write, not for the list to come back.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}
