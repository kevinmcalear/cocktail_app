import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DilutionDefaults } from '@/lib/drinkMath';
import { supabase } from '@/lib/supabase';

/** The venue's house dilution by method (bars.dilution_defaults); {} when unset. */
export function useDilutionDefaults(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['dilution-defaults', barId],
    enabled: !!barId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DilutionDefaults> => {
      const { data, error } = await supabase.from('bars').select('dilution_defaults').eq('id', barId!).maybeSingle();
      if (error) throw error;
      return ((data?.dilution_defaults as DilutionDefaults | null) ?? {}) as DilutionDefaults;
    },
  });
}

/** Admins set the house dilution. The server recomputes every drink at the venue. */
export function useSetDilutionDefaults(barId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (defaults: DilutionDefaults) => {
      const { error } = await supabase.from('bars').update({ dilution_defaults: defaults }).eq('id', barId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dilution-defaults', barId] });
      void queryClient.invalidateQueries({ queryKey: ['cocktail'] });
    },
  });
}

/** A measured dilution for one drink (items.dilution_pct), or null to go back to the default. */
export function useSetDilution(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pct: number | null) => {
      const { error } = await supabase.from('items').update({ dilution_pct: pct }).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['cocktail', itemId] }),
  });
}
