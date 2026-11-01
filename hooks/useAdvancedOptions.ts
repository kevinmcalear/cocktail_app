import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * A venue's Advanced options (jam dec-24, kept by Kevin 31 Oct when the other
 * feature switches went): wash lines on glasses, Fit it in the drink editor,
 * and Ice and Tools in setup. Off unless the venue turns it on in its
 * settings. Its home is bars.advanced_options (20261204300000_one_home.sql),
 * which old builds' feature switch stays in step with. The one
 * place the app reads or writes it.
 */
const advancedKey = (barId: string | null) => ['venue-advanced', barId] as const;

export function useBarAdvanced(barId: string | null | undefined): boolean {
  const id = barId ?? null;
  const { data } = useQuery({
    queryKey: advancedKey(id),
    enabled: !!id,
    meta: { persist: true },
    queryFn: async (): Promise<boolean> => {
      const { data: row, error } = await supabase.from('bars').select('advanced_options').eq('id', id!).maybeSingle();
      if (error) throw error;
      return row?.advanced_options ?? false;
    },
  });
  return data ?? false;
}

/** Turns a venue's Advanced options on or off. Only its Admins can (bars_update). */
export function useSetBarAdvanced(barId: string) {
  const client = useQueryClient();
  const queryKey = advancedKey(barId);
  return useMutation({
    mutationFn: async (on: boolean) => {
      const { data, error } = await supabase.from('bars').update({ advanced_options: on }).eq('id', barId).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Only the venue’s Admins can switch Advanced options.');
    },
    onMutate: async (on) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<boolean>(queryKey);
      client.setQueryData(queryKey, on);
      return { previous };
    },
    onError: (_error, _on, context) => client.setQueryData(queryKey, context?.previous ?? false),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
}
