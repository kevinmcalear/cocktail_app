import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { BAR_WRITES, type ShiftsWrite } from '@/hooks/barWrites';
import { patchShifts, type RotaChange, type RotaShift } from '@/lib/rota';
import { supabase } from '@/lib/supabase';

export type Shift = RotaShift;

/** The bar's rota between two times (shifts that overlap them), in start order. Names come from useBarMembers. */
export function useShifts(barId: string | null | undefined, fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ['shifts', barId, fromIso, toIso],
    enabled: !!barId,
    queryFn: async (): Promise<Shift[]> => {
      const { data, error } = await supabase
        .from('shifts')
        .select('id, user_id, starts_at, ends_at, opens, closes, note, created_by')
        .eq('bar_id', barId!)
        .lt('starts_at', toIso)
        .gt('ends_at', fromIso)
        .order('starts_at');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Change the rota: add, edit, copy and delete shifts, each one write
 * (RotaChange). It works with no signal: it shows on every open week at once,
 * waits on the phone and sends when there's signal (hooks/barWrites.ts), in
 * the order it was made. Use `mutate`, not `mutateAsync`: a queued write
 * doesn't resolve until it sends. `onRefused` hears a write the database said
 * no to; the refetch after it puts the rota back.
 */
export function useSaveShifts(barId: string, onRefused?: () => void) {
  const queryClient = useQueryClient();
  const me = useUserId();
  const write = BAR_WRITES.shifts;
  const mutation = useMutation({
    mutationKey: write.key,
    mutationFn: write.send,
    scope: { id: 'shifts' },
    onMutate: async (w: ShiftsWrite) => {
      await queryClient.cancelQueries({ queryKey: ['shifts', barId] });
      for (const [key] of queryClient.getQueriesData<Shift[]>({ queryKey: ['shifts', barId] })) {
        const [, , from, to] = key as [string, string, string, string];
        queryClient.setQueryData<Shift[]>(key, (old) => (old ? patchShifts(old, w, from, to, me) : old));
      }
    },
    onError: () => onRefused?.(),
    onSettled: (_data, _error, w) => {
      for (const queryKey of write.refresh(w)) void queryClient.invalidateQueries({ queryKey });
    },
  });
  return { ...mutation, mutate: (change: Partial<RotaChange>) => mutation.mutate({ barId, rows: change.rows ?? [], removed: change.removed ?? [] }) };
}
