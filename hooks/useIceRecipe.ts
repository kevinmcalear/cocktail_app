import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { savePrepCard, type PrepCardInput } from '@/hooks/usePrepCard';
import { iceWaySteps, type IceWayKey } from '@/lib/iceRecipes';
import { supabase } from '@/lib/supabase';

// How a venue's ice is made (Kit and ice, steps 7 and 8; docs/kit_and_ice.md):
// its steps (item_steps, each naming its tools) and Makes/Keeps (item_prep)
// like a house prep, and what it starts from as one recipes line: another of
// the venue's ice (a block, a slab, cubes) or a flavour. Never made_from_id or
// ingredient_role, which are for ingredients only. Anyone with Prep at the
// venue writes all three (20261110100000_kit_and_ice.sql); the kit check (PR 4)
// follows ice back through this line.

export interface IceStartsFrom {
  id: string;
  /** Null when this person can't read the item; the venue's ice list has its name. */
  name: string | null;
  ice: boolean;
}

export const iceStartsFromKey = (iceId: string | null | undefined) => ['ice-starts-from', iceId] as const;

/** What an ice starts from, or null when it starts from water (or isn't said). */
export function useIceStartsFrom(iceId: string | null | undefined) {
  return useQuery({
    queryKey: iceStartsFromKey(iceId),
    enabled: !!iceId,
    queryFn: async (): Promise<IceStartsFrom | null> => {
      const { data, error } = await supabase
        .from('recipes')
        .select('ingredient_item_id, from:items!ingredient_item_id(name, item_type)')
        .eq('recipe_item_id', iceId!)
        .order('sort_order')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.ingredient_item_id) return null;
      const from = data.from as { name: string; item_type: string } | null;
      return { id: data.ingredient_item_id, name: from?.name ?? null, ice: from ? from.item_type === 'ice' : true };
    },
  });
}

/** The venue's other ice that start from this one: never offered as what it starts from, so a chain can't loop. */
export function useIcesStartingFrom(iceId: string | null | undefined) {
  return useQuery({
    queryKey: ['ices-starting-from', iceId],
    enabled: !!iceId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('recipes').select('recipe_item_id, item:items!recipe_item_id!inner(item_type)').eq('ingredient_item_id', iceId!).eq('item.item_type', 'ice');
      if (error) throw error;
      return (data ?? []).flatMap((r) => (r.recipe_item_id ? [r.recipe_item_id] : []));
    },
  });
}

export interface IceRecipeInput {
  /** The item it starts from; null for water. Undefined leaves the line as it is (and its note). */
  startsFrom?: string | null;
  card: PrepCardInput;
}

/**
 * Replace what an ice starts from (only when it changed), then its card and steps.
 * ponytail: separate writes like a house prep's savePrepCard, so a dropped
 * connection mid-save can leave part of it; one RPC (a migration) if that bites.
 */
export async function saveIceRecipe(iceId: string, { startsFrom, card }: IceRecipeInput) {
  if (startsFrom !== undefined) await replaceStartsFrom(iceId, startsFrom);
  await savePrepCard(iceId, card);
}

async function replaceStartsFrom(iceId: string, startsFrom: string | null) {
  const gone = await supabase.from('recipes').delete().eq('recipe_item_id', iceId);
  if (gone.error) throw gone.error;
  if (startsFrom) {
    const added = await supabase.from('recipes').insert({ recipe_item_id: iceId, ingredient_item_id: startsFrom, sort_order: 0 });
    if (added.error) throw added.error;
  }
}

const EMPTY_PREP: PrepCardInput['prep'] = { yield_amount: null, yield_unit: null, shelf_life_hours: null, lead_time_minutes: null, lead_time_note: null, storage: null, actions: [] };

/**
 * A starting recipe for an ice made here, from one of the ways (lib/iceRecipes):
 * the Add sheet (PR 2) calls this right after save_venue_ice returns the id.
 */
export function startIceRecipe(ice: { id: string; size_mm?: number | null; stamped?: boolean; frozen_inside?: string | null }, way: IceWayKey, startsFrom: string | null) {
  return saveIceRecipe(ice.id, { startsFrom, card: { prep: { ...EMPTY_PREP, storage: 'Freezer' }, steps: iceWaySteps(way, ice).map((s) => ({ body: s.body, timer_seconds: null, equipment: s.tools })) } });
}

/** Save an ice's recipe from its editor. */
export function useSaveIceRecipe(iceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: IceRecipeInput) => saveIceRecipe(iceId, input),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: iceStartsFromKey(iceId) });
      void client.invalidateQueries({ queryKey: ['item-prep', iceId] });
      void client.invalidateQueries({ queryKey: ['ices-starting-from'] });
      // A flavour typed by name may be a new ingredient of the venue's.
      void client.invalidateQueries({ queryKey: ['venue-ingredients'] });
    },
  });
}
