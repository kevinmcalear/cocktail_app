import { useQuery } from '@tanstack/react-query';

import { toDay } from '@/lib/collection';
import type { HandoverRow } from '@/lib/handover';
import { supabase } from '@/lib/supabase';

// Apart from useHandover.ts so Tonight's first load on the web carries only
// this query: the note itself is put together in the parts that show it.

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
