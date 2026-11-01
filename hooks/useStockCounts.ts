import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { BAR_WRITES, type ZoneCountWrite } from '@/hooks/barWrites';
import { newDraftId } from '@/lib/drinkWizard';
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

/**
 * Save one zone's count: the count row, then its lines. It works with no
 * signal: the count waits on the phone, survives the app closing, and sends
 * when there's signal (hooks/barWrites.ts). `isPaused` says it's waiting.
 */
export function useSaveZoneCount(barId: string) {
  const queryClient = useQueryClient();
  // The signed-in user the app already has; auth.getUser() would be a network call per save.
  const userId = useAuth().user?.id ?? null;
  const write = BAR_WRITES.zoneCount;
  const mutation = useMutation({
    mutationKey: write.key,
    mutationFn: write.send,
    onSettled: (_id, _error, w) => {
      for (const queryKey of write.refresh(w)) void queryClient.invalidateQueries({ queryKey });
    },
  });
  // Ids made here, once, so a resend after a dropped connection finds the count already there.
  const withIds = ({ zoneId, lines, note }: { zoneId: string | null; lines: CountLineInput[]; note?: string | null }): ZoneCountWrite => ({
    id: newDraftId(),
    barId,
    zoneId,
    note: note ?? null,
    countedBy: userId,
    lines: lines.map((l) => ({ ...l, id: newDraftId() })),
  });
  return { ...mutation, mutate: (input: Parameters<typeof withIds>[0]) => mutation.mutate(withIds(input)) };
}
