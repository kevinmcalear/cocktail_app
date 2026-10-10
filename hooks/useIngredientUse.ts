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
        .from('items')
        .select('id, recipes:app_recipe_presentation!recipe_item_id!inner(id)', { count: 'exact', head: true })
        .eq('item_type', 'cocktail')
        .eq('recipes.ingredient_item_id', ingredientId!);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
