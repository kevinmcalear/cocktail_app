import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * A venue's Advanced options (jam dec-24, kept by Kevin 31 Oct when the other
 * feature switches went): wash lines on glasses, Fit it in the drink editor,
 * and Ice and Tools in setup. Off unless the venue turns it on in its
 * settings. The one place the app reads or writes it.
 * ponytail: stored as 'advanced' in bars.enabled_features until the Data
 * lane gives it a column of its own; then only this file changes.
 */
const advancedKey = (barId: string | null) => ['venue-advanced', barId] as const;

export function useBarAdvanced(barId: string | null | undefined): boolean {
  const id = barId ?? null;
  const { data } = useQuery({
    queryKey: advancedKey(id),
    enabled: !!id,
    meta: { persist: true },
    queryFn: async (): Promise<boolean> => {
      const { data: row, error } = await supabase.from('bars').select('enabled_features').eq('id', id!).maybeSingle();
      if (error) throw error;
      const on = row?.enabled_features;
      return Array.isArray(on) && on.includes('advanced');
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
      const { error } = await supabase.rpc('set_venue_feature', { p_bar_id: barId, p_feature: 'advanced', p_enabled: on });
      if (error) throw error;
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
