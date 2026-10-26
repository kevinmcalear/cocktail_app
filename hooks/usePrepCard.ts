import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { saveItemAllergens } from '@/hooks/useAllergens';
import { ensureIngredient } from '@/hooks/useCreateIngredient';
import { DROPDOWNS_QUERY_KEY } from '@/hooks/useDropdowns';
import { recentEntry } from '@/hooks/useTrackRecent';
import { isGarnishUnit } from '@/lib/batch';
import { plainDbMessage } from '@/lib/dbError';
import { existingIngredientId } from '@/lib/ingredientNames';
import type { NoteLine } from '@/lib/noteRecipe';
import { prepAmounts, prepYield, type PrepDraft } from '@/lib/prepKinds';
import { partsRatio, prepParts } from '@/lib/prepParts';
import { capitalizeFirst } from '@/lib/stringUtils';
import { supabase } from '@/lib/supabase';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';

export interface PrepStep {
  position: number;
  body: string;
  timer_seconds: number | null;
  /** The tools it needs: equipment ids or a venue's own tool names. */
  equipment: string[];
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
const STEP_COLUMNS = 'position, body, timer_seconds, equipment';

/** A house-made ingredient's or a venue ice's prep card: yield, shelf life, lead time, storage, actions and steps. */
export function useItemPrep(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['item-prep', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<PrepCardData> => {
      const [prep, steps] = await Promise.all([
        supabase.from('item_prep').select(PREP_COLUMNS).eq('item_id', itemId!).maybeSingle(),
        supabase.from('item_steps').select(STEP_COLUMNS).eq('item_id', itemId!).order('position'),
      ]);
      if (prep.error) throw prep.error;
      if (steps.error) throw steps.error;
      return { prep: (prep.data as ItemPrep | null) ?? null, steps: (steps.data ?? []) as PrepStep[] };
    },
  });
}

export interface PrepCardInput {
  prep: ItemPrep;
  steps: { body: string; timer_seconds: number | null; equipment?: string[] }[];
}

/** Upsert an item's prep row and replace its steps. Also used when a new house prep is saved from the add-drink wizard. */
export async function savePrepCard(itemId: string, { prep, steps }: PrepCardInput) {
  const saved = await supabase.from('item_prep').upsert({ item_id: itemId, ...prep }, { onConflict: 'item_id' });
  if (saved.error) throw saved.error;
  const gone = await supabase.from('item_steps').delete().eq('item_id', itemId);
  if (gone.error) throw gone.error;
  const kept = steps.map((s) => ({ body: s.body.trim(), timer_seconds: s.timer_seconds, equipment: s.equipment ?? [] })).filter((s) => s.body);
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
  /** How much of this one a batch of it takes (null when masked or to taste). */
  amount: number | string | null;
  unit: string | null;
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
        .select('amount, unit, parent:app_item_presentation!recipe_item_id(id, name, item_type)')
        .eq('display_ingredient_id', itemId!);
      if (error) throw error;
      const seen = new Map<string, UsedInPrep>();
      let garnish = false;
      const pours: PrepUsedIn['pours'] = {};
      for (const row of (data ?? []) as unknown as { amount: number | string | null; unit: string | null; parent: { id: string; name: string; item_type: string } | null }[]) {
        if (row.parent?.item_type === 'ingredient') seen.set(row.parent.id, { id: row.parent.id, name: row.parent.name, amount: row.amount, unit: row.unit });
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
export async function savePrepRecipe(
  itemId: string,
  prep: PrepDraft,
  ensure: (pick: { id: string | null; name: string }, type: 'ingredient') => Promise<string>,
  barId: string | null = null,
  /**
   * A line made in-house too (make-anything-steps-2, step 8) becomes a prep
   * row of its own: its id, and whether this save made it (an existing prep,
   * "My Honey syrup", keeps its recipe). With `warn`, a recipe inside that
   * fails is said, and the rest still saved.
   */
  inner?: { own: (pick: { id: string | null; name: string }) => Promise<{ id: string; isNew: boolean }>; warn: (message: string) => void }
) {
  const role = await supabase.from('items').update({ ingredient_role: 'prep' }).eq('id', itemId);
  if (role.error) throw role.error;
  const rows = [];
  let baseId: string | null = null;
  // Lines made in-house too (make-anything-steps-2, step 8): each a prep row of its own, its recipe saved after this one's.
  const inside: { id: string; name: string; prep: PrepDraft }[] = [];
  for (const [i, { line, amount }] of prepAmounts(prep).entries()) {
    // A stand-in nobody filled ("Spirit") is never an ingredient.
    if (!line.name.trim() || line.slot) continue;
    const made = line.prep && inner ? await inner.own({ id: null, name: line.name }) : null;
    const id = made ? made.id : await ensure({ id: line.id, name: line.name }, 'ingredient');
    if (made?.isNew && id !== itemId && line.prep) inside.push({ id, name: line.name, prep: line.prep });
    if (line.key === prep.baseKey) baseId = id;
    rows.push({ recipe_item_id: itemId, ingredient_item_id: id, amount, unit: line.unit || null, preparation_notes: line.note?.trim() || null, sort_order: i });
  }
  if (rows.length) {
    const added = await supabase.from('recipes').insert(rows);
    if (added.error) throw added.error;
  }
  // Made it house from a bottle in the drink, or a base line that's a bottle.
  const madeFrom = prep.madeFrom?.id ?? null;
  const fromBase = !madeFrom && baseId ? (await supabase.from('items').select('ingredient_role').eq('id', baseId).maybeSingle()).data?.ingredient_role === 'product' : false;
  if (madeFrom || fromBase) {
    const from = await supabase.from('items').update({ made_from_id: madeFrom ?? baseId }).eq('id', itemId);
    if (from.error) throw from.error;
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
  // Allergens the maker set by hand are declared, and checked, for where it's made.
  if (prep.allergensSet) await saveItemAllergens(itemId, barId, prep.allergens ?? []);
  for (const p of inside) {
    try {
      await savePrepRecipe(p.id, p.prep, ensure, barId, inner);
    } catch (e) {
      inner!.warn(plainDbMessage(e) ?? `${p.name}’s recipe wasn’t saved. Add it on its page.`);
    }
  }
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
            steps: source.card.steps.map((s) => ({ body: s.body, timer_seconds: s.timer_seconds, equipment: s.equipment })),
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

/** "1 : 1": a prep's recipe as parts, for the Kind of row on a riff of it. Null when it doesn't read as a ratio. */
export function usePrepRatio(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['prep-ratio', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<string | null> => {
      // The presentation view: the raw recipes table is for the prep's editors only (RLS), so a riff's page showed no ratio.
      const { data, error } = await supabase.from('app_recipe_presentation').select('id, amount, unit').eq('recipe_item_id', itemId!).order('sort_order');
      if (error) throw error;
      const lines = ((data ?? []) as { id: string; amount: number | null; unit: string | null }[]).map((r) => ({ ...r, name: '' }));
      return partsRatio(prepParts(lines));
    },
  });
}

/**
 * A venue's own version of a shared prep: copy it to the venue, then point
 * the venue's own drinks and preps at the copy. Everyone else keeps the
 * shared one. Recipes RLS already limits the swap to items the person can
 * edit, so a line they can't change stays on the shared prep.
 */
export function useMakeVenueVersion() {
  const queryClient = useQueryClient();
  const copy = useCopyPrep();
  return useMutation({
    mutationFn: async ({ source, name, barId }: { source: PrepCopySource; name: string; barId: string }): Promise<{ id: string; swapped: number }> => {
      const id = await copy.mutateAsync({ source, name, barId });
      const { data, error } = await supabase
        .from('recipes')
        .select('id, item:recipe_item_id!inner(bar_id)')
        .eq('ingredient_item_id', source.id)
        .eq('item.bar_id', barId);
      if (error) throw error;
      const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
      if (ids.length) {
        const swapped = await supabase.from('recipes').update({ ingredient_item_id: id }).in('id', ids);
        if (swapped.error) throw swapped.error;
      }
      return { id, swapped: ids.length };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ingredient'] });
      void queryClient.invalidateQueries({ queryKey: ['cocktail'] });
    },
  });
}

export interface PrepSource {
  field: 'recipe' | 'yield' | 'keeps';
  url: string;
  note: string | null;
}

/**
 * Where a shared prep's recipe, yield and keep come from (item_sources), so the
 * page can say "Ratio from imbibemagazine.com". Signed-in readers only, like
 * the table; a venue's own prep has none.
 */
export function usePrepSources(itemId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['prep-sources', itemId],
    enabled: !!itemId && enabled,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<PrepSource[]> => {
      const { data, error } = await supabase
        .from('item_sources')
        .select('field, url, note')
        .eq('item_id', itemId!)
        .in('field', ['recipe', 'yield', 'keeps'])
        .order('url');
      if (error) throw error;
      return (data ?? []) as PrepSource[];
    },
  });
}

export interface CatalogRecipe {
  id: string;
  name: string;
  lines: { id: string | null; name: string; amount: number | null; unit: string | null; note: string | null; optional: boolean }[];
  card: PrepCardData;
  /** The pages its ratio was checked on (two for a staple), when it cites any. */
  checkedOn: string[];
}

/**
 * The shared catalog's recipe for a prep of this name (or alias), when it has
 * one with amounts: what a new house version starts from. Null otherwise.
 */
export function useCatalogRecipe(name: string | null | undefined) {
  const key = name?.trim().toLowerCase() ?? '';
  return useQuery({
    queryKey: ['catalog-recipe', key],
    enabled: !!key,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<CatalogRecipe | null> => {
      const { data: id, error } = await supabase.rpc('resolve_ingredient', { p_name: name!.trim() });
      if (error) throw error;
      if (!id) return null;
      const [item, lines, prep, steps, sources] = await Promise.all([
        supabase.from('items').select('id, name, bar_id, ingredient_role').eq('id', id).maybeSingle(),
        supabase
          .from('app_recipe_presentation')
          .select('amount, unit, preparation_notes, is_optional, sort_order, display_ingredient(id, name)')
          .eq('recipe_item_id', id)
          .order('sort_order'),
        supabase.from('item_prep').select(PREP_COLUMNS).eq('item_id', id).maybeSingle(),
        supabase.from('item_steps').select(STEP_COLUMNS).eq('item_id', id).order('position'),
        supabase.from('item_sources').select('url').eq('item_id', id).eq('field', 'recipe').order('url'),
      ]);
      if (item.error) throw item.error;
      if (lines.error) throw lines.error;
      const row = item.data as { id: string; name: string; bar_id: string | null; ingredient_role: string | null } | null;
      if (!row || row.bar_id || row.ingredient_role !== 'prep') return null;
      type Line = { amount: number | null; unit: string | null; preparation_notes: string | null; is_optional: boolean | null; display_ingredient: { id: string; name: string } | null };
      const recipe = ((lines.data ?? []) as unknown as Line[])
        .filter((l) => l.display_ingredient)
        .map((l) => ({ id: l.display_ingredient!.id, name: l.display_ingredient!.name, amount: l.amount, unit: l.unit, note: l.preparation_notes, optional: !!l.is_optional }));
      if (!recipe.some((l) => l.amount != null)) return null;
      return {
        id: row.id,
        name: row.name,
        lines: recipe,
        card: { prep: (prep.data as ItemPrep | null) ?? null, steps: (steps.data ?? []) as PrepStep[] },
        // A signed-out reader can't read sources: the recipe still comes, without its pages.
        checkedOn: ((sources.data ?? []) as { url: string }[]).map((s) => s.url),
      };
    },
  });
}

/**
 * Something you make, saved from its own page (New › Something you make,
 * make-anything-steps-3, step 11): a house prep row of its own, its recipe,
 * method and keeping, and any recipe made in-house inside it as a prep of
 * its own. A name that's taken becomes your version at home ("My Honey
 * syrup", as the drink's save does); at a venue it says so. If anything
 * fails, the rows this save made go again.
 */
export function useCreatePrep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, prep, barId }: { name: string; prep: PrepDraft; barId: string | null }): Promise<{ id: string; name: string; warnings: string[] }> => {
      const made = new Map<string, string>();
      const warnings: string[] = [];
      const rows: string[] = [];
      const insert = (row: { name: string; generic_id?: string }) => supabase.from('items').insert({ ...row, item_type: 'ingredient', bar_id: barId, ingredient_role: 'prep' }).select('id').single();
      // A new prep row, or the one that already has the name (`isNew` false: it keeps its own recipe).
      const prepRow = async (raw: string): Promise<{ id: string; isNew: boolean; name: string }> => {
        const n = capitalizeFirst(raw.trim());
        let { data, error } = await insert({ name: n });
        const taken = existingIngredientId(error);
        if (taken && !barId) ({ data, error } = await insert({ name: `My ${n}`, generic_id: taken }));
        const yours = taken ? (barId ? taken : existingIngredientId(error)) : null;
        if (yours) return { id: yours, isNew: false, name: n };
        if (error || !data) throw error ?? new Error(`Couldn’t add ${n}.`);
        rows.push(data.id as string);
        return { id: data.id as string, isNew: true, name: taken ? `My ${n}` : n };
      };
      const top = await prepRow(name);
      if (!top.isNew) throw new Error(`${capitalizeFirst(name.trim())} is already ${barId ? 'here' : 'yours'}. Search for it instead.`);
      const ensure = (pick: { id: string | null; name: string }) => ensureIngredient(pick, barId, made);
      const own = async (pick: { id: string | null; name: string }) => {
        const r = await prepRow(pick.name);
        if (!r.isNew) warnings.push(`${capitalizeFirst(pick.name)} is already here, so it uses that one. Change its recipe on its page.`);
        return r;
      };
      try {
        await savePrepRecipe(top.id, prep, ensure, barId, { own, warn: (m) => warnings.push(m) });
      } catch (e) {
        await supabase.from('items').delete().in('id', rows);
        throw e;
      }
      useRecentActivityStore.getState().push(recentEntry('ingredient', top.id, top.name, { barId }));
      void qc.invalidateQueries({ queryKey: ['ingredients'] });
      void qc.invalidateQueries({ queryKey: DROPDOWNS_QUERY_KEY });
      if (barId) void qc.invalidateQueries({ queryKey: ['bar', barId] });
      return { id: top.id, name: top.name, warnings };
    },
  });
}
