import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { BAR_WRITES, type BatchWrite } from '@/hooks/barWrites';
import { newDraftId } from '@/lib/drinkWizard';
import { supabase } from '@/lib/supabase';
import type { Batch } from '@/lib/stock';

/** How far back batches are read: older ones sit under a count by then. ponytail: read per item since its last count if a bar goes weeks between counts. */
const BATCH_DAYS = 14;

/** A bar's batches of house-made from the last two weeks, newest first (batch_logs). */
export function useBatchLogs(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['batch-logs', barId],
    enabled: !!barId,
    queryFn: async (): Promise<Batch[]> => {
      const since = new Date(Date.now() - BATCH_DAYS * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('batch_logs')
        .select('id, item_id, amount, unit, made_at, made_by')
        .eq('bar_id', barId!)
        .gte('made_at', since)
        .order('made_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, itemId: r.item_id, amount: Number(r.amount), unit: r.unit, madeAt: r.made_at, madeBy: r.made_by }));
    },
  });
}

/**
 * Log a batch of house-made (the house-made page's Log batch, Tonight's
 * Before doors). It works with no signal: the batch waits on the phone and
 * sends when there's signal (hooks/barWrites.ts). Use `mutate`, not
 * `mutateAsync`: a queued write doesn't resolve until it sends.
 */
export function useLogBatch(barId: string) {
  const queryClient = useQueryClient();
  const userId = useAuth().user?.id ?? null;
  const write = BAR_WRITES.batch;
  const mutation = useMutation({
    mutationKey: write.key,
    mutationFn: write.send,
    onSettled: (_id, _error, w) => {
      for (const queryKey of write.refresh(w)) void queryClient.invalidateQueries({ queryKey });
    },
  });
  const withId = (input: { itemId: string; amount: number; unit: string; locationId?: string | null; note?: string | null }): BatchWrite => ({
    id: newDraftId(),
    barId,
    itemId: input.itemId,
    amount: input.amount,
    unit: input.unit,
    madeAt: new Date().toISOString(),
    madeBy: userId,
    locationId: input.locationId ?? null,
    note: input.note ?? null,
  });
  // It returns the batch it logs, so its label can open at once: router.push(labelHref(batch)).
  const mutate = (input: Parameters<typeof withId>[0]): BatchWrite => {
    const batch = withId(input);
    mutation.mutate(batch);
    return batch;
  };
  return { ...mutation, mutate };
}
