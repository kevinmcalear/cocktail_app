import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { useDrafts } from '@/hooks/useDrafts';
import { savePrepCard, savePrepRecipe } from '@/hooks/usePrepCard';
import { dropdownKeys, refreshIngredients } from '@/hooks/useDropdowns';
import { recentEntry } from '@/hooks/useTrackRecent';
import { saveDrinkSpec } from '@/hooks/useVersions';
import { track } from '@/lib/analytics';
import { plainDbMessage } from '@/lib/dbError';
import { creatorProfileId, likeExactly, specLines, type WizardDraft, type WizardPick } from '@/lib/drinkWizard';
import { existingIngredientId } from '@/lib/ingredientNames';
import type { PrepDraft } from '@/lib/prepKinds';
import { capitalize } from '@/lib/stringUtils';
import { techniqueById } from '@/lib/techniques';
import { prepCardFor } from '@/lib/techniques/makeIt';
import type { SketchInputs } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';
import { useMenuDrinkHandoff } from '@/store/useMenuDrinkHandoff';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';

export interface CreateDrinkInput {
  draft: WizardDraft;
  /** The venue it's added at; null for a drink at home. */
  barId: string | null;
  /** Your own person profile, for "I made it". */
  myProfileId: string | null;
  /** Adding it from a menu section: it lands in that section. */
  menuSectionId?: string | null;
  /** The drawing the wizard showed (draftSketchInputs): the new drink shows it at once, not its glass icon. */
  sketch?: SketchInputs | null;
}

export interface CreateDrinkResult {
  id: string;
  /** Saved, but these parts didn't stick (said the way a person would want to hear it). */
  warnings: string[];
}

type ItemType = 'ingredient' | 'method' | 'glassware' | 'ice';

/**
 * Saves the add-drink wizard's drink in one go, at the end: any ingredient,
 * method, glass or ice typed in that doesn't exist yet, then the drink with
 * its credits, then its spec (a first version, through save_drink_spec). If
 * the spec can't be written the half-made drink is removed again, so trying
 * again doesn't leave a copy; the draft stays on the device until this
 * succeeds.
 */
export function useCreateDrink() {
  const qc = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: async ({ draft, barId, myProfileId, menuSectionId, sketch }: CreateDrinkInput): Promise<CreateDrinkResult> => {
      if (!userId) throw new Error('Sign in to save drinks.');
      const warnings: string[] = [];
      // New rows the pickers' lists don't have yet: ingredients by id, spec items (glass, method, ice) at all.
      const newIngredients: string[] = [];
      let newSpecs = false;

      // A picked row can be gone by now (merged into another ingredient since
      // the draft was made, 20261008100000): those go by name, like a typed one.
      const pickedIds = [
        ...specLines(draft).map(({ line }) => line.id),
        ...draft.methods.map((m) => m.id),
        draft.glass?.id,
        draft.ice?.id,
      ].filter((v): v is string => !!v);
      const live = new Set<string>();
      if (pickedIds.length) {
        const { data, error } = await supabase.from('items').select('id').in('id', [...new Set(pickedIds)]);
        if (error) throw error;
        for (const r of data ?? []) live.add(r.id);
      }

      // Typed-in names become rows once, even if two lines share one.
      const made = new Map<string, string>();
      const ensure = async (pick: WizardPick, type: ItemType): Promise<string> => {
        if (pick.id && live.has(pick.id)) return pick.id;
        const key = `${type}:${pick.name.trim().replace(/\s+/g, ' ').toLowerCase()}`;
        const known = made.get(key);
        if (known) return known;
        // A name missing from the picker may still exist, under any spelling or
        // another name ("1:1 sugar syrup" is Simple Syrup): use that, never a copy.
        const resolved = type === 'ingredient' ? await supabase.rpc('resolve_ingredient', { p_name: pick.name }) : null;
        const found =
          resolved && !resolved.error && resolved.data
            ? { id: resolved.data as string }
            : (
                await supabase
                  .from('items')
                  .select('id')
                  .eq('item_type', type)
                  .ilike('name', likeExactly(pick.name))
                  .limit(1)
                  .maybeSingle()
              ).data;
        if (found) {
          made.set(key, found.id);
          return found.id;
        }
        const { data, error } = await supabase
          .from('items')
          .insert({ name: capitalize(pick.name), item_type: type, bar_id: type === 'ingredient' ? barId : null })
          .select('id')
          .single();
        // The database knows a name we didn't (an alias added since): it says which to use.
        const existing = existingIngredientId(error);
        if (existing) {
          made.set(key, existing);
          return existing;
        }
        if (error || !data) throw error ?? new Error(`Couldn’t add ${pick.name}.`);
        made.set(key, data.id);
        if (type === 'ingredient') newIngredients.push(data.id);
        else newSpecs = true;
        return data.id;
      };

      const lines = [];
      // New house preps made by a technique, to get their prep card once the drink is in.
      const preps: { id: string; technique: string }[] = [];
      // New house preps with their own recipe (made in the wizard), saved once the drink is in.
      const ownPreps: { id: string; name: string; prep: PrepDraft }[] = [];
      for (const { line, amount } of specLines(draft)) {
        const madeBefore = newIngredients.length;
        const ingredientId = await ensure(line, 'ingredient');
        const isNew = newIngredients.length > madeBefore;
        if (line.prep && isNew) ownPreps.push({ id: ingredientId, name: line.name, prep: line.prep });
        else if (line.technique && isNew) preps.push({ id: ingredientId, technique: line.technique });
        lines.push({
          id: null,
          ingredient_item_id: ingredientId,
          amount,
          unit: line.unit || null,
          preparation_notes: null,
          is_optional: false,
        });
      }
      const methodIds: string[] = [];
      for (const m of draft.methods) methodIds.push(await ensure(m, 'method'));
      const glassId = draft.glass ? await ensure(draft.glass, 'glassware') : null;
      const iceId = draft.ice ? await ensure(draft.ice, 'ice') : null;

      // A venue's drink is credited to the venue too.
      let originBar: string | null = null;
      if (barId) {
        const { data } = await supabase.from('profiles').select('id').eq('bar_id', barId).eq('kind', 'bar').limit(1).maybeSingle();
        originBar = data?.id ?? null;
      }
      const creatorId = creatorProfileId(draft, myProfileId);

      const row = {
        id: undefined as string | undefined,
        name: capitalize(draft.name),
        item_type: 'cocktail',
        bar_id: barId,
        description: draft.description.trim() || null,
        notes: draft.notes.trim() || null,
        glassware_id: glassId,
        sketch_variant: draft.glassVariant ?? null,
        ice_id: iceId,
        riff_of_id: draft.riffOf?.id ?? null,
        creator_profile_id: creatorId,
        origin_bar_profile_id: originBar,
        // You can claim your own credit; anyone else's starts as suggested.
        credit_status: creatorId && creatorId === myProfileId ? 'claimed' : null,
      };
      // Under the draft's id, so it's drawn with the wizard's seed. A clash
      // (an earlier try that saved but never answered) gets an id of its own.
      // (undefined is left out of the request, so the database makes one.)
      const insert = (id: string | undefined) => supabase.from('items').insert({ ...row, id }).select('id').single();
      let { data: item, error: itemError } = await insert(draft.id);
      if (itemError?.code === '23505' && draft.id) ({ data: item, error: itemError } = await insert(undefined));
      if (itemError || !item) throw itemError ?? new Error('Couldn’t save the drink.');
      const id = item.id as string;

      try {
        // Every method, in order, in the same transaction as the spec.
        await saveDrinkSpec(id, lines, methodIds, null);
      } catch (e) {
        await supabase.from('items').delete().eq('id', id);
        throw e;
      }

      // The drawing the wizard showed stays the drink's: the worker won't
      // repaint it until the drink changes (20261009750000_maker_drawings).
      // Decorative, so a failure only means the worker draws it as usual.
      // No glass drawing picked goes without "variant": the database stores
      // the default drawing that way and refuses a null one.
      if (sketch) {
        const { variant, ...rest } = sketch;
        await supabase.rpc('save_maker_sketch', { p_item_id: id, p_inputs: variant ? sketch : rest });
      }

      if (draft.publish) {
        const { error } = await supabase.from('items').update({ publish_mode: draft.publish }).eq('id', id);
        if (error) warnings.push(plainDbMessage(error) ?? 'It’s saved as private: who can see it didn’t change.');
      }

      // Not the person credited first, and only people with a profile (the database checks both).
      const coIds = [...new Set((draft.coCreators ?? []).map((c) => c.id).filter((p): p is string => !!p && p !== creatorId))];
      if (coIds.length) {
        const { error } = await supabase.from('item_co_creators').insert(coIds.map((profile_id) => ({ item_id: id, profile_id })));
        if (error) warnings.push(plainDbMessage(error) ?? 'The people who made it with you weren’t added. Add them on the drink’s page.');
      }

      // A prep made here: its recipe, method and keeping, on the row this save made.
      for (const p of ownPreps) {
        try {
          await savePrepRecipe(p.id, p.prep, ensure);
        } catch (e) {
          warnings.push(plainDbMessage(e) ?? `${capitalize(p.name)}’s recipe wasn’t saved. Add it on its page.`);
        }
      }

      // Only rows this save made get a card: an existing prep keeps its own.
      for (const p of preps) {
        const t = techniqueById(p.technique);
        if (!t) continue;
        const card = prepCardFor(t);
        try {
          await savePrepCard(p.id, {
            prep: { yield_amount: null, yield_unit: null, shelf_life_hours: null, lead_time_minutes: card.leadMinutes, lead_time_note: card.leadNote, storage: null, actions: card.actions },
            steps: card.steps,
          });
        } catch (e) {
          warnings.push(plainDbMessage(e) ?? `${t.name} steps weren’t added to the new prep. Add them on its page.`);
        }
      }

      if (menuSectionId) useMenuDrinkHandoff.getState().deliver(menuSectionId, id);

      // The worker writes its drawing inputs a little later; until then (and
      // instead of a cached "none yet") it shows the drawing the wizard did.
      if (sketch) qc.setQueryData(['item-sketch', id], sketch);
      useRecentActivityStore.getState().push(recentEntry('cocktail', id, capitalize(draft.name), { barId }));
      void qc.invalidateQueries({ queryKey: ['cocktails'] });
      if (barId) void qc.invalidateQueries({ queryKey: ['bar', barId] });
      if (newSpecs) void qc.invalidateQueries({ queryKey: dropdownKeys.specs });
      void refreshIngredients(qc, newIngredients);
      if (creatorId) void qc.invalidateQueries({ queryKey: ['profile-originals'] });
      return { id, warnings };
    },
    onSuccess: (_, { barId, menuSectionId }) => track('drink_created', { at_bar: !!barId, on_menu: !!menuSectionId }),
    // The wizard says what went wrong itself, and keeps the draft.
    onError: () => {},
  });
}
