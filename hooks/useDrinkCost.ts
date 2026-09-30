import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface CostLine {
  ingredient: string;
  /** Minor units for this line's amount; null when nothing on the way has a price. */
  minor: number | null;
  kind: 'ml' | 'g' | 'each';
  garnish: boolean;
}

export interface DrinkCost {
  liquid_minor: number;
  garnish_minor: number;
  ice_minor: number;
  total_minor: number;
  /** Lines with no price yet. */
  missing: number;
  lines: CostLine[];
}

/**
 * What a serve costs this bar (drink_cost). Runs as the caller, so it comes
 * back null for anyone without the costs capability; the section stays
 * locked for them.
 */
export function useDrinkCost(itemId: string | null | undefined, barId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['drink-cost', barId, itemId],
    enabled: !!itemId && !!barId && enabled,
    queryFn: async (): Promise<DrinkCost | null> => {
      const { data, error } = await supabase.rpc('drink_cost', { p_item: itemId!, p_bar: barId! });
      if (error) throw error;
      return (data as DrinkCost | null) ?? null;
    },
  });
}

/** The menu price (items.price_minor), or null to clear it. */
export function useSetMenuPrice(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (minor: number | null) => {
      const { error } = await supabase.from('items').update({ price_minor: minor }).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cocktail', itemId] });
      void queryClient.invalidateQueries({ queryKey: ['menu-costing'] });
    },
  });
}
