import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * How many drinks you can see use an ingredient ("In 14 drinks", under an
 * ingredient search result): a count only, no rows. Cached per ingredient,
 * so typing on through the same results asks once.
 */
export function useIngredientUse(ingredientId: string | null | undefined) {
  return useQuery({
    queryKey: ['ingredient-use', ingredientId],
    enabled: !!ingredientId,
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('recipes')
        .select('recipe_item_id, drink:items!new_recipes_recipe_item_id_fkey!inner(item_type)', { count: 'exact', head: true })
        .eq('ingredient_item_id', ingredientId!)
        .eq('drink.item_type', 'cocktail');
      if (error) throw error;
      return count ?? 0;
    },
  });
}
