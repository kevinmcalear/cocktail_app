import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isGarnishUnit } from '@/lib/batch';
import { supabase } from '@/lib/supabase';

export interface PrepStep {
  position: number;
  body: string;
  timer_seconds: number | null;
}

export interface ItemPrep {
  yield_amount: number | null;
  yield_unit: string | null;
  shelf_life_hours: number | null;
  lead_time_minutes: number | null;
  lead_time_note: string | null;
  storage: string | null;
  actions: string[];
}

export interface PrepCardData {
  /** Null until someone fills the card in. */
  prep: ItemPrep | null;
  steps: PrepStep[];
}

const PREP_COLUMNS = 'yield_amount, yield_unit, shelf_life_hours, lead_time_minutes, lead_time_note, storage, actions';

/** A house-made ingredient's prep card: yield, shelf life, lead time, storage, actions and steps. */
export function useItemPrep(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['item-prep', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<PrepCardData> => {
      const [prep, steps] = await Promise.all([
        supabase.from('item_prep').select(PREP_COLUMNS).eq('item_id', itemId!).maybeSingle(),
        supabase.from('item_steps').select('position, body, timer_seconds').eq('item_id', itemId!).order('position'),
      ]);
      if (prep.error) throw prep.error;
      if (steps.error) throw steps.error;
      return { prep: (prep.data as ItemPrep | null) ?? null, steps: (steps.data ?? []) as PrepStep[] };
    },
  });
}

export interface PrepCardInput {
  prep: ItemPrep;
  steps: { body: string; timer_seconds: number | null }[];
}

/** Upsert an item's prep row and replace its steps. Also used when a new house prep is saved from the add-drink wizard. */
export async function savePrepCard(itemId: string, { prep, steps }: PrepCardInput) {
  const saved = await supabase.from('item_prep').upsert({ item_id: itemId, ...prep }, { onConflict: 'item_id' });
  if (saved.error) throw saved.error;
  const gone = await supabase.from('item_steps').delete().eq('item_id', itemId);
  if (gone.error) throw gone.error;
  const kept = steps.map((s) => s.body.trim()).map((body, i) => ({ body, timer_seconds: steps[i].timer_seconds })).filter((s) => s.body);
  if (kept.length) {
    const added = await supabase.from('item_steps').insert(kept.map((s, position) => ({ item_id: itemId, position, ...s })));
    if (added.error) throw added.error;
  }
}

/** Save the card: upsert the prep row and replace the steps. */
export function useSaveItemPrep(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PrepCardInput) => savePrepCard(itemId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['item-prep', itemId] });
      void queryClient.invalidateQueries({ queryKey: ['prep-data'] });
    },
  });
}

export interface UsedInPrep {
  id: string;
  name: string;
}

export interface PrepUsedIn {
  /** The other house-made ingredients this one goes into (drinks are listed by useIngredient). */
  preps: UsedInPrep[];
  /** It goes on a drink as a garnish (a twist, a wheel, a sprig), so it can carry a prep card of its own. */
  garnish: boolean;
  /** How much each drink pours, by drink id, as this role's recipe view shows it (null amounts when masked). */
  pours: Record<string, { amount: number | string | null; unit: string | null }>;
}

/** Where this ingredient goes: into other preps, and whether it's a garnish on a drink. */
export function usePrepUsedIn(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['prep-used-in', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<PrepUsedIn> => {
      const { data, error } = await supabase
        .from('app_recipe_presentation')
        .select('amount, unit, parent:app_item_presentation!new_recipes_recipe_item_id_fkey(id, name, item_type)')
        .eq('display_ingredient_id', itemId!);
      if (error) throw error;
      const seen = new Map<string, UsedInPrep>();
      let garnish = false;
      const pours: PrepUsedIn['pours'] = {};
      for (const row of (data ?? []) as unknown as { amount: number | string | null; unit: string | null; parent: { id: string; name: string; item_type: string } | null }[]) {
        if (row.parent?.item_type === 'ingredient') seen.set(row.parent.id, { id: row.parent.id, name: row.parent.name });
        else if (row.parent) pours[row.parent.id] = { amount: row.amount, unit: row.unit };
        if (isGarnishUnit(row.unit)) garnish = true;
      }
      return { preps: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)), garnish, pours };
    },
  });
}
