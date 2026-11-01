import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Row } from '@/types/db';

export type Shift = Pick<Row<'shifts'>, 'id' | 'user_id' | 'starts_at' | 'ends_at' | 'opens' | 'closes' | 'note'>;

/** The bar's rota between two times (shifts that overlap them), in start order. Names come from useBarMembers. */
export function useShifts(barId: string | null | undefined, fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ['shifts', barId, fromIso, toIso],
    enabled: !!barId,
    queryFn: async (): Promise<Shift[]> => {
      const { data, error } = await supabase
        .from('shifts')
        .select('id, user_id, starts_at, ends_at, opens, closes, note')
        .eq('bar_id', barId!)
        .lt('starts_at', toIso)
        .gt('ends_at', fromIso)
        .order('starts_at');
      if (error) throw error;
      return data ?? [];
    },
  });
}
