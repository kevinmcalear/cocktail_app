import { useMutation, useQueryClient } from '@tanstack/react-query';

import { readParts, setPartFresh, type StoredPart } from '@/lib/drinkParts';
import type { ServiceStyle } from '@/lib/service';
import type { PresentationRecipe } from '@/lib/spec';
import { supabase } from '@/lib/supabase';

interface CachedDrink {
  service_style?: string | null;
  /** items.parts as read (hooks/useCocktails.ts). */
  madeInParts?: StoredPart[] | null;
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

/**
 * A later part of a drink made in parts, made fresh for each serve or ahead in
 * the batch (items.parts "fresh", 20261126200000). Reads the parts first, so a
 * name changed elsewhere isn't written back over; the drink's edit policy guards it.
 */
export function useSetPartFresh(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ n, fresh }: { n: number; fresh: boolean }) => {
      const { data, error } = await supabase.from('items').select('parts').eq('id', itemId).single();
      if (error) throw error;
      const parts = readParts(data.parts);
      if (!parts) throw new Error('This drink is in one part now.');
      const { data: saved, error: saveError } = await supabase.from('items').update({ parts: setPartFresh(parts, n, fresh) }).eq('id', itemId).select('id');
      if (saveError) throw saveError;
      if (!saved?.length) throw new Error("You can't change how this drink is made.");
    },
    onMutate: async ({ n, fresh }) => {
      // A fetch already on its way would land after this and flip the part back.
      await queryClient.cancelQueries({ queryKey: ['cocktail', itemId] });
      queryClient.setQueriesData<CachedDrink | null>({ queryKey: ['cocktail', itemId] }, (old) =>
        old?.madeInParts ? { ...old, madeInParts: setPartFresh(old.madeInParts, n, fresh) } : old
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
