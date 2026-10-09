import { useMutation, useQueryClient } from '@tanstack/react-query';

import { DROPDOWNS_QUERY_KEY } from '@/hooks/useDropdowns';
import { recentEntry } from '@/hooks/useTrackRecent';
import { likeExactly, type WizardPick } from '@/lib/drinkWizard';
import { existingIngredientId } from '@/lib/ingredientNames';
import type { IngredientDraft } from '@/lib/ingredientWizard';
import { capitalizeFirsts } from '@/lib/stringUtils';
import { supabase } from '@/lib/supabase';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';

export interface CreateIngredientInput {
  draft: IngredientDraft;
  /** The venue it's added at; null for a shared one. */
  barId: string | null;
}

const number = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * Saves the ingredient wizard's draft in one go: the ingredient, then its
 * recipe, making any ingredient typed into the recipe that doesn't exist yet
 * (by any spelling or alias it's the existing one, never a copy). If the
 * recipe can't be written the ingredient is removed again, so trying again
 * doesn't leave a copy; the draft stays on the device until this succeeds.
 */
export function useCreateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ draft, barId }: CreateIngredientInput): Promise<{ id: string }> => {
      const { data, error } = await supabase
        .from('items')
        .insert({
          item_type: 'ingredient',
          name: capitalizeFirsts(draft.name),
          brand_maker: draft.role === 'product' ? capitalizeFirsts(draft.maker) || null : null,
          generic_id: draft.generic?.id ?? null,
          abv: draft.role === 'other' ? null : number(draft.abv),
          description: draft.description.trim() || null,
          bar_id: barId,
          ingredient_role: draft.role === 'product' || draft.role === 'prep' ? draft.role : null,
        })
        .select('id')
        .single();
      // A shared ingredient with this name (or an alias) already exists: say so, with which.
      if (existingIngredientId(error)) throw new Error(`${capitalizeFirsts(draft.name)} is already here. Search for it instead.`);
      if (error || !data) throw error ?? new Error('Couldn’t save the ingredient.');
      const id = data.id as string;

      const lines = draft.role === 'prep' ? draft.lines : [];
      if (lines.length) {
        try {
          const made = new Map<string, string>();
          const rows = [];
          for (const [i, l] of lines.entries()) {
            rows.push({ recipe_item_id: id, ingredient_item_id: await ensureIngredient(l, barId, made), amount: number(l.amount), unit: l.unit || null, sort_order: i });
          }
          const { error: recipeError } = await supabase.from('recipes').insert(rows);
          if (recipeError) throw recipeError;
        } catch (e) {
          await supabase.from('items').delete().eq('id', id);
          throw e;
        }
      }

      useRecentActivityStore.getState().push(recentEntry('ingredient', id, capitalizeFirsts(draft.name), { barId }));
      void qc.invalidateQueries({ queryKey: ['ingredients'] });
      void qc.invalidateQueries({ queryKey: DROPDOWNS_QUERY_KEY });
      if (barId) void qc.invalidateQueries({ queryKey: ['bar', barId] });
      return { id };
    },
    // The wizard says what went wrong itself, and keeps the draft.
    onError: () => {},
  });
}

/**
 * The ingredient a recipe line means: the picked one, else the existing one
 * by name or alias, else a new one. Also turns a note into recipe lines
 * (usePrepCard's useAdoptNoteRecipe). ponytail: the add-drink wizard's save
 * (useCreateDrink) still has the same lookup inline, with its own bookkeeping.
 */
export async function ensureIngredient(pick: WizardPick, barId: string | null, made: Map<string, string>): Promise<string> {
  if (pick.id) return pick.id;
  const key = pick.name.trim().replace(/\s+/g, ' ').toLowerCase();
  const known = made.get(key);
  if (known) return known;
  const resolved = await supabase.rpc('resolve_ingredient', { p_name: pick.name });
  const found =
    !resolved.error && resolved.data
      ? (resolved.data as string)
      : (await supabase.from('items').select('id').eq('item_type', 'ingredient').ilike('name', likeExactly(pick.name)).limit(1).maybeSingle()).data?.id;
  if (found) {
    made.set(key, found);
    return found;
  }
  const { data, error } = await supabase.from('items').insert({ name: capitalizeFirsts(pick.name), item_type: 'ingredient', bar_id: barId }).select('id').single();
  const existing = existingIngredientId(error);
  if (existing) return existing;
  if (error || !data) throw error ?? new Error(`Couldn’t add ${pick.name}.`);
  made.set(key, data.id);
  return data.id;
}
