import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ensureIngredient } from '@/hooks/useCreateIngredient';
import { isGarnishUnit } from '@/lib/batch';
import type { NoteLine } from '@/lib/noteRecipe';
import { prepAmounts, prepYield, type PrepDraft } from '@/lib/prepKinds';
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

/**
 * After a batch: what it really made becomes the prep's yield, so the next
 * scale starts from the truth. Only the yield columns change.
 */
export function useLearnYield(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ amount, unit }: { amount: number; unit: string }) => {
      const { error } = await supabase.from('item_prep').upsert({ item_id: itemId, yield_amount: amount, yield_unit: unit }, { onConflict: 'item_id' });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['item-prep', itemId] }),
  });
}

/**
 * A house prep made in the add-drink wizard (lib/prepKinds): marks the new row
 * as a prep, writes its recipe lines (typed names become ingredients through
 * `ensure`, the drink save's own resolver) and its card: yield, keeps,
 * storage, lead time, actions and steps. A base line that's a bottle (a fat
 * wash of Bacardí) is what the prep is made from.
 */
export async function savePrepRecipe(itemId: string, prep: PrepDraft, ensure: (pick: { id: string | null; name: string }, type: 'ingredient') => Promise<string>) {
  const role = await supabase.from('items').update({ ingredient_role: 'prep' }).eq('id', itemId);
  if (role.error) throw role.error;
  const rows = [];
  let baseId: string | null = null;
  for (const [i, { line, amount }] of prepAmounts(prep).entries()) {
    if (!line.name.trim()) continue;
    const id = await ensure({ id: line.id, name: line.name }, 'ingredient');
    if (line.key === prep.baseKey) baseId = id;
    rows.push({ recipe_item_id: itemId, ingredient_item_id: id, amount, unit: line.unit || null, sort_order: i });
  }
  if (rows.length) {
    const added = await supabase.from('recipes').insert(rows);
    if (added.error) throw added.error;
  }
  if (baseId) {
    const { data: base } = await supabase.from('items').select('ingredient_role').eq('id', baseId).maybeSingle();
    if (base?.ingredient_role === 'product') {
      const from = await supabase.from('items').update({ made_from_id: baseId }).eq('id', itemId);
      if (from.error) throw from.error;
    }
  }
  const made = prepYield(prep);
  await savePrepCard(itemId, {
    prep: {
      yield_amount: made,
      yield_unit: made ? 'ml' : null,
      shelf_life_hours: prep.keepsHours,
      lead_time_minutes: prep.leadMinutes,
      lead_time_note: null,
      storage: prep.storage || null,
      actions: prep.actions,
    },
    steps: prep.steps,
  });
}

/**
 * A recipe written as a note becomes the prep's own: its lines (each name
 * found or added the way the ingredient wizard does), marked as a prep, and
 * its steps when the card has none yet. The note itself stays as written.
 */
export function useAdoptNoteRecipe(itemId: string, barId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ lines, steps, card }: { lines: NoteLine[]; steps: string[]; card: PrepCardData | undefined }) => {
      if (lines.length) {
        const made = new Map<string, string>();
        const rows = [];
        for (const [i, l] of lines.entries()) {
          rows.push({ recipe_item_id: itemId, ingredient_item_id: await ensureIngredient({ id: null, name: l.name }, barId, made), amount: l.amount, unit: l.unit, preparation_notes: l.note ?? null, sort_order: i });
        }
        const added = await supabase.from('recipes').insert(rows);
        if (added.error) throw added.error;
      }
      const role = await supabase.from('items').update({ ingredient_role: 'prep' }).eq('id', itemId).is('ingredient_role', null);
      if (role.error) throw role.error;
      if (steps.length && !card?.steps.length) {
        const prep = card?.prep ?? { yield_amount: null, yield_unit: null, shelf_life_hours: null, lead_time_minutes: null, lead_time_note: null, storage: null, actions: [] };
        await savePrepCard(itemId, { prep, steps: steps.map((body) => ({ body, timer_seconds: null })) });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ingredient', itemId] });
      void queryClient.invalidateQueries({ queryKey: ['item-prep', itemId] });
      void queryClient.invalidateQueries({ queryKey: ['drink-allergens', itemId] });
    },
  });
}

export interface PrepCopySource {
  id: string;
  name: string;
  description: string | null;
  abv?: number | null;
  /** The lines as this role sees them; a line with a hidden ingredient isn't copied. */
  lines: { ingredientId: string | null; amount: number | string | null; unit: string | null; note: string | null; optional: boolean }[];
  card: PrepCardData | undefined;
}

/**
 * Your own version of a prep someone else keeps (a shared recipe, another
 * bar's): a copy at your venue, or yours at home, that's a kind of the
 * original, with its lines, card and steps. Drinks keep using the original
 * until their line is swapped.
 */
export function useCopyPrep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ source, name, barId }: { source: PrepCopySource; name: string; barId: string | null }): Promise<string> => {
      const { data, error } = await supabase
        .from('items')
        .insert({ name, item_type: 'ingredient', bar_id: barId, description: source.description, abv: source.abv ?? null, generic_id: source.id, ingredient_role: 'prep' })
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('Couldn’t make your version.');
      const id = data.id as string;
      try {
        const rows = source.lines
          .filter((l) => l.ingredientId)
          .map((l, i) => ({ recipe_item_id: id, ingredient_item_id: l.ingredientId!, amount: l.amount === null || l.amount === '' ? null : Number(l.amount), unit: l.unit, preparation_notes: l.note, is_optional: l.optional, sort_order: i }));
        if (rows.length) {
          const added = await supabase.from('recipes').insert(rows);
          if (added.error) throw added.error;
        }
        if (source.card?.prep || source.card?.steps.length) {
          await savePrepCard(id, {
            prep: source.card.prep ?? { yield_amount: null, yield_unit: null, shelf_life_hours: null, lead_time_minutes: null, lead_time_note: null, storage: null, actions: [] },
            steps: source.card.steps.map((s) => ({ body: s.body, timer_seconds: s.timer_seconds })),
          });
        }
      } catch (e) {
        await supabase.from('items').delete().eq('id', id);
        throw e;
      }
      return id;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ingredients'] }),
  });
}
