import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ServiceStyle } from '@/lib/service';
import type { PresentationRecipe } from '@/lib/spec';
import { supabase } from '@/lib/supabase';

interface CachedDrink {
  service_style?: string | null;
  recipes?: (PresentationRecipe & { id?: string })[] | null;
}

/**
 * Decide where a spec line goes: in the batch (false) or added at the station
 * (true). Writes recipes.at_service, which the drink's own edit policy guards,
 * and updates the open drink page straight away.
 */
export function useSetLineService(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, atService }: { key: string; atService: boolean }) => {
      const { error } = await supabase.from('recipes').update({ at_service: atService }).eq('id', key);
      if (error) throw error;
    },
    onMutate: ({ key, atService }) => {
      queryClient.setQueriesData<CachedDrink | null>({ queryKey: ['cocktail', itemId] }, (old) =>
        old ? { ...old, recipes: old.recipes?.map((r) => (r.id === key ? { ...r, at_service: atService } : r)) } : old
      );
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['cocktail', itemId] }),
  });
}

/** How the drink is served (items.service_style), or null to clear it. */
export function useSetServiceStyle(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (style: ServiceStyle | null) => {
      const { error } = await supabase.from('items').update({ service_style: style }).eq('id', itemId);
      if (error) throw error;
    },
    onMutate: (style) => {
      queryClient.setQueriesData<CachedDrink | null>({ queryKey: ['cocktail', itemId] }, (old) => (old ? { ...old, service_style: style } : old));
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['cocktail', itemId] }),
  });
}
