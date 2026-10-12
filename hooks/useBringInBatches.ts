import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toBatch, type BatchInput, type BringInBatch } from '@/lib/bringInBatch';
import { plainDbMessage } from '@/lib/dbError';
import { supabase } from '@/lib/supabase';

const COLUMNS = 'id, bar_id, source, title, menu_id, item_ids, summary, created_at, undone_at';
const KEY = ['bring-in-batches'];

/**
 * Your last bring-in here (a venue, or home when barId is null), for Bring
 * in's "Last time" row. Null when there's none, or before the batches table
 * reaches this database (the row just doesn't show).
 */
export function useLastBringIn(barId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'last', barId],
    queryFn: async (): Promise<BringInBatch | null> => {
      let query = supabase.from('bring_in_batches').select(COLUMNS).is('undone_at', null).order('created_at', { ascending: false }).limit(1);
      query = barId ? query.eq('bar_id', barId) : query.is('bar_id', null);
      const { data, error } = await query;
      if (error) return null;
      return data?.[0] ? toBatch(data[0]) : null;
    },
  });
}

/** One bring-in, for Brought in. */
export function useBringInBatch(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'one', id],
    enabled: !!id,
    queryFn: async (): Promise<BringInBatch | null> => {
      const { data, error } = await supabase.from('bring_in_batches').select(COLUMNS).eq('id', id!).maybeSingle();
      if (error) throw error;
      return data ? toBatch(data) : null;
    },
  });
}

/**
 * Records a finished bring-in. Resolves its id, or null when it couldn't be
 * recorded: what was made stays made, only Undo all and Last time go missing.
 */
export function useRecordBringIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BatchInput): Promise<string | null> => {
      const { data, error } = await supabase
        .from('bring_in_batches')
        .insert({
          bar_id: input.barId,
          source: input.source.slice(0, 80),
          title: input.title.slice(0, 120) || 'Brought in',
          menu_id: input.menuId,
          item_ids: input.itemIds.slice(0, 500),
          shelf_ids: input.shelfIds.slice(0, 200),
          prices: input.prices.slice(0, 500),
          summary: input.summary,
        })
        .select('id')
        .single();
      if (error) return null;
      return data.id as string;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

/** Undo all: takes back what a bring-in made. Things used since by another drink or menu stay. */
export function useUndoBringIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: string): Promise<{ removed: number; kept: number }> => {
      const { data, error } = await supabase.rpc('undo_bring_in', { p_batch: batchId });
      if (error) throw new Error(plainDbMessage(error) ?? 'Couldn’t undo that.');
      const result = (data ?? {}) as { removed?: number; kept?: number };
      return { removed: result.removed ?? 0, kept: result.kept ?? 0 };
    },
    onSuccess: () =>
      Promise.all(
        [KEY, ['cocktails'], ['ingredients'], ['menu-library'], ['home-bar'], ['menus']].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      ),
    onError: () => {},
  });
}
