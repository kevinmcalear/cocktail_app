import { useMutation, useQuery } from '@tanstack/react-query';

import { useCreateIngredient } from '@/hooks/useCreateIngredient';
import { savePrepCard } from '@/hooks/usePrepCard';
import type { PrepLine } from '@/lib/batchPrep';
import { newLine } from '@/lib/drinkWizard';
import { EMPTY_INGREDIENT } from '@/lib/ingredientWizard';
import { supabase } from '@/lib/supabase';

/** How long each of these house preps keeps (item_prep.shelf_life_hours), by id. Plain JSON. */
export function useShelfLives(itemIds: readonly string[]) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['shelf-lives', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from('item_prep').select('item_id, shelf_life_hours').in('item_id', ids);
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as { item_id: string; shelf_life_hours: number | null }[]).filter((r) => r.shelf_life_hours).map((r) => [r.item_id, r.shelf_life_hours!]));
    },
  });
}

/** One house-made item a batch saves: its name, recipe for this many serves, yield and how long it keeps. */
export type BatchPrep = { name: string; lines: PrepLine[]; yieldMl: number; shelfHours: number | null };

/**
 * "Save as house-made" on a venue batch: a house prep for each container,
 * with its recipe for this many serves, its yield and how long it keeps. A
 * one-part drink's bottle is "<drink> batch", which lib/itemImages matches
 * back to the drink by name. Resolves to the new items' ids, in order.
 */
export function useSaveBatchAsPrep(barId: string | null) {
  const create = useCreateIngredient();
  return useMutation({
    mutationFn: async (preps: BatchPrep[]) => {
      const ids: string[] = [];
      // One at a time, in order: a failure stops there, and the ones before it stay saved.
      for (const { name, lines, yieldMl, shelfHours } of preps) {
        const { id } = await create.mutateAsync({
          draft: { ...EMPTY_INGREDIENT, name, role: 'prep', lines: lines.map((l) => newLine({ id: l.id, name: l.name }, l.unit, l.amount)) },
          barId,
        });
        await savePrepCard(id, {
          prep: { yield_amount: Math.round(yieldMl), yield_unit: 'ml', shelf_life_hours: shelfHours, lead_time_minutes: null, lead_time_note: null, storage: null, actions: [] },
          steps: [],
        });
        ids.push(id);
      }
      return ids;
    },
    onError: () => {},
  });
}
