import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { BAR_WRITES, handoverColumns, type HandoverWrite } from '@/hooks/barWrites';
import { useBarMembers } from '@/hooks/useBarDetail';
import { toDay } from '@/lib/collection';
import { isUnread, lastNote, noteFor, readByLine, type HandoverRow } from '@/lib/handover';
import { supabase } from '@/lib/supabase';

/** How far back a note is still news: a bar shut for a long weekend still hands over. */
const DAYS = 7;

const handoverKey = (barId: string | null, tonight: string | null) => ['handover', barId, tonight] as const;

/** The bar's handover rows from the last week of closes, up to tonight's (handover_notes). */
export function useHandoverRows(barId: string | null, tonight: string | null) {
  return useQuery({
    queryKey: handoverKey(barId, tonight),
    enabled: !!barId && !!tonight,
    queryFn: async (): Promise<HandoverRow[]> => {
      const since = new Date(`${tonight}T12:00:00`);
      since.setDate(since.getDate() - DAYS);
      const { data, error } = await supabase
        .from('handover_notes')
        .select('close_date, user_id, ran_out, note, prep, broken, broken_photo, written_at, read_at')
        .eq('bar_id', barId!)
        .gte('close_date', toDay(since))
        .lte('close_date', tonight!)
        .order('close_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Tonight's handover (Loop-handover): the last close's note, whether it still
 * sits on top for you, who has read it, and what you left for tonight's
 * close. `serviceDate` is the service day at local midnight (useServiceDate).
 */
export function useHandover(barId: string | null, serviceDate: Date | null) {
  const me = useUserId();
  const tonight = serviceDate ? toDay(serviceDate) : null;
  const query = useHandoverRows(barId, tonight);
  const rows = query.data ?? [];
  const last = tonight ? lastNote(rows, tonight) : null;
  const mine = tonight ? noteFor(rows, tonight) : null;
  const members = useBarMembers(rows.length ? barId : null).data ?? [];
  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.display_name ?? 'Someone';
  return {
    rows,
    tonight,
    last,
    unread: isUnread(last, rows, me),
    readBy: last ? readByLine(last.readers, me, nameOf) : null,
    /** Tonight's close: what's been left so far (yours and any other closer's). */
    tonightNote: mine,
    nameOf,
    me,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * Write your part of a close's note, or mark it read. Works with no signal:
 * it waits on the phone and sends when there's signal (hooks/barWrites.ts),
 * and the page shows it at once.
 */
export function useSaveHandover(barId: string) {
  const queryClient = useQueryClient();
  const write = BAR_WRITES.handover;
  return useMutation({
    mutationKey: write.key,
    mutationFn: write.send,
    onMutate: (w: HandoverWrite) => {
      for (const [key, rows] of queryClient.getQueriesData<HandoverRow[]>({ queryKey: ['handover', barId] })) {
        if (!rows) continue;
        const old = rows.find((r) => r.close_date === w.closeDate && r.user_id === w.userId);
        const row: HandoverRow = { close_date: w.closeDate, user_id: w.userId, ran_out: [], note: null, prep: null, broken: null, broken_photo: null, written_at: null, ...old, ...handoverColumns(w.words), read_at: w.readAt };
        queryClient.setQueryData(key, [row, ...rows.filter((r) => r !== old)]);
      }
    },
    onSettled: (_data, _error, w) => {
      for (const queryKey of write.refresh(w)) void queryClient.invalidateQueries({ queryKey });
    },
  });
}
