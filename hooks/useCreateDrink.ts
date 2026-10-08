import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { useDrafts } from '@/hooks/useDrafts';
import { DROPDOWNS_QUERY_KEY } from '@/hooks/useDropdowns';
import { recentEntry } from '@/hooks/useTrackRecent';
import { saveDrinkSpec } from '@/hooks/useVersions';
import { track } from '@/lib/analytics';
import { plainDbMessage } from '@/lib/dbError';
import { creatorProfileId, likeExactly, specLines, type WizardDraft, type WizardPick } from '@/lib/drinkWizard';
import { existingIngredientId } from '@/lib/ingredientNames';
import { withDrinkInSection } from '@/lib/menuDrinkAttach';
import { capitalize } from '@/lib/stringUtils';
import type { SketchInputs } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';
import { useCreatorNavStore } from '@/store/useCreatorNavStore';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';

export interface CreateDrinkInput {
  draft: WizardDraft;
  /** The venue it's added at; null for a drink at home. */
  barId: string | null;
  /** Your own person profile, for "I made it". */
  myProfileId: string | null;
  /** Adding it from a menu section: it lands in that section. */
  menuDraftId?: string | null;
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
  const userId = useAuth().user?.id ?? null;
  const { drafts, saveDraft } = useDrafts();

  return useMutation({
    mutationFn: async ({ draft, barId, myProfileId, menuDraftId, menuSectionId, sketch }: CreateDrinkInput): Promise<CreateDrinkResult> => {
      if (!userId) throw new Error('Sign in to save drinks.');
      const warnings: string[] = [];
      let createdLookups = false;

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
        createdLookups = true;
        return data.id;
      };

      const lines = [];
      for (const { line, amount } of specLines(draft)) {
        lines.push({
          id: null,
          ingredient_item_id: await ensure(line, 'ingredient'),
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
      // repaint it until the drink changes (20261009950000_maker_drawings).
      // Decorative, so a failure only means the worker draws it as usual.
      if (sketch) await supabase.rpc('save_maker_sketch', { p_item_id: id, p_inputs: sketch });

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

      if (menuSectionId) {
        const menuDraft = menuDraftId ? drafts.find((d) => d.id === menuDraftId) : null;
        if (menuDraft) {
          const selections = withDrinkInSection(menuDraft.draft_data?.selections || {}, menuSectionId, id);
          await saveDraft({ id: menuDraft.id, entityType: 'menu', draftData: { ...menuDraft.draft_data, selections } });
        }
        useCreatorNavStore.getState().deliverMenuDrink(menuSectionId, id);
      }

      // The worker writes its drawing inputs a little later; until then (and
      // instead of a cached "none yet") it shows the drawing the wizard did.
      if (sketch) qc.setQueryData(['item-sketch', id], sketch);
      useRecentActivityStore.getState().push(recentEntry('cocktail', id, capitalize(draft.name), { barId }));
      void qc.invalidateQueries({ queryKey: ['cocktails'] });
      if (barId) void qc.invalidateQueries({ queryKey: ['bar', barId] });
      if (createdLookups) void qc.invalidateQueries({ queryKey: DROPDOWNS_QUERY_KEY });
      if (creatorId) void qc.invalidateQueries({ queryKey: ['profile-originals'] });
      return { id, warnings };
    },
    onSuccess: (_, { barId, menuDraftId }) => track('drink_created', { at_bar: !!barId, on_menu: !!menuDraftId }),
    // The wizard says what went wrong itself, and keeps the draft.
    onError: () => {},
  });
}
