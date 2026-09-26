import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { SpecLevels } from '@/lib/spec';

/**
 * The levels at which a venue drink's names, amounts and prep notes open: the
 * drink's own overrides, else the venue's defaults. Used only to label locked
 * sections ("Opens at Bartender"); the server does the actual hiding.
 */
export function useSpecLevels(itemId: string | null | undefined, barId: string | null | undefined) {
  return useQuery({
    queryKey: ['spec-levels', itemId, barId],
    enabled: !!itemId && !!barId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SpecLevels | null> => {
      const [bar, item] = await Promise.all([
        supabase
          .from('bars')
          .select('default_generic_ingredient_level, default_specific_brand_level, default_measurement_level, default_prep_level')
          .eq('id', barId!)
          .maybeSingle(),
        supabase
          .from('items')
          .select('override_generic_ingredient_level, override_specific_brand_level, override_measurement_level, override_prep_level')
          .eq('id', itemId!)
          .maybeSingle(),
      ]);
      if (bar.error) throw bar.error;
      if (!bar.data) return null;
      // ponytail: if the item row isn't readable at this role, the venue's
      // defaults are the best label we have.
      const o = item.data;
      return {
        generic: o?.override_generic_ingredient_level ?? bar.data.default_generic_ingredient_level,
        brand: o?.override_specific_brand_level ?? bar.data.default_specific_brand_level,
        measurement: o?.override_measurement_level ?? bar.data.default_measurement_level,
        prep: o?.override_prep_level ?? bar.data.default_prep_level,
      };
    },
  });
}
