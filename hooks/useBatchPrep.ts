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

/**
 * "Save as house-made" on a venue batch: a house prep named "<drink> batch"
 * with the bottle's recipe for this many serves, its yield and how long it
 * keeps. lib/itemImages matches "<drink> batch" back to the drink by name.
 */
export function useSaveBatchAsPrep(barId: string | null) {
  const create = useCreateIngredient();
  return useMutation({
    mutationFn: async ({ name, lines, yieldMl, shelfHours }: { name: string; lines: PrepLine[]; yieldMl: number; shelfHours: number | null }) => {
      const { id } = await create.mutateAsync({
        draft: { ...EMPTY_INGREDIENT, name: `${name} batch`, role: 'prep', lines: lines.map((l) => newLine({ id: l.id, name: l.name }, l.unit, l.amount)) },
        barId,
      });
      await savePrepCard(id, {
        prep: { yield_amount: Math.round(yieldMl), yield_unit: 'ml', shelf_life_hours: shelfHours, lead_time_minutes: null, lead_time_note: null, storage: null, actions: [] },
        steps: [],
      });
      return id;
    },
    onError: () => {},
  });
}
