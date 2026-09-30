import { useMutation, useQueryClient } from '@tanstack/react-query';

import { DROPDOWNS_QUERY_KEY } from '@/hooks/useDropdowns';
import { supabase } from '@/lib/supabase';

/** A glass's capacity and iced capacity (items.capacity_ml, items.iced_capacity_ml), for whoever can edit the glass. */
export function useSetGlassSize(glassId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (size: { capacity_ml: number | null; iced_capacity_ml: number | null }) => {
      const { error } = await supabase.from('items').update(size).eq('id', glassId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: DROPDOWNS_QUERY_KEY }),
  });
}

/** The ice a serve of this drink takes (items.ice_per_serve_g), or null to unset it. */
export function useSetIcePerServe(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (grams: number | null) => {
      const { error } = await supabase.from('items').update({ ice_per_serve_g: grams }).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cocktail', itemId] });
      void queryClient.invalidateQueries({ queryKey: ['prep-data'] });
    },
  });
}
