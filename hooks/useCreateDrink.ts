import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { useDrafts } from '@/hooks/useDrafts';
import { DROPDOWNS_QUERY_KEY } from '@/hooks/useDropdowns';
import { recentEntry } from '@/hooks/useTrackRecent';
import { saveDrinkSpec } from '@/hooks/useVersions';
import { plainDbMessage } from '@/lib/dbError';
import { creatorProfileId, likeExactly, specLines, type WizardDraft, type WizardPick } from '@/lib/drinkWizard';
import { withDrinkInSection } from '@/lib/menuDrinkAttach';
import { capitalize } from '@/lib/stringUtils';
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
    mutationFn: async ({ draft, barId, myProfileId, menuDraftId, menuSectionId }: CreateDrinkInput): Promise<CreateDrinkResult> => {
      if (!userId) throw new Error('Sign in to save drinks.');
      const warnings: string[] = [];
      let createdLookups = false;

      // Typed-in names become rows once, even if two lines share one.
      const made = new Map<string, string>();
      const ensure = async (pick: WizardPick, type: ItemType): Promise<string> => {
        if (pick.id) return pick.id;
        const key = `${type}:${pick.name.trim().replace(/\s+/g, ' ').toLowerCase()}`;
        const known = made.get(key);
        if (known) return known;
        // The dropdown lists stop at 1,000 rows, so a name missing from them may
        // still exist: look it up (any case) before making another "Freezer Pour".
        const { data: found } = await supabase
          .from('items')
          .select('id')
          .eq('item_type', type)
          .ilike('name', likeExactly(pick.name))
          .limit(1)
          .maybeSingle();
        if (found) {
          made.set(key, found.id);
          return found.id;
        }
        const { data, error } = await supabase
          .from('items')
          .insert({ name: capitalize(pick.name), item_type: type, bar_id: type === 'ingredient' ? barId : null })
          .select('id')
          .single();
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

      const { data: item, error: itemError } = await supabase
        .from('items')
        .insert({
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
        })
        .select('id')
        .single();
      if (itemError || !item) throw itemError ?? new Error('Couldn’t save the drink.');
      const id = item.id as string;

      try {
        await saveDrinkSpec(id, lines, methodIds, null);
        // ponytail: save_drink_spec takes one method; the rest follow it in
        // order. Upgrade path: an array argument on the RPC (and the editor).
        if (methodIds.length > 1) {
          const { error } = await supabase
            .from('item_methods')
            .insert(methodIds.slice(1).map((method_item_id, i) => ({ item_id: id, method_item_id, sort_order: i + 1 })));
          if (error) throw error;
        }
      } catch (e) {
        await supabase.from('items').delete().eq('id', id);
        throw e;
      }

      if (draft.publish) {
        const { error } = await supabase.from('items').update({ publish_mode: draft.publish }).eq('id', id);
        if (error) warnings.push(plainDbMessage(error) ?? 'It’s saved as private: who can see it didn’t change.');
      }

      if (menuSectionId) {
        const menuDraft = menuDraftId ? drafts.find((d) => d.id === menuDraftId) : null;
        if (menuDraft) {
          const selections = withDrinkInSection(menuDraft.draft_data?.selections || {}, menuSectionId, id);
          await saveDraft({ id: menuDraft.id, entityType: 'menu', draftData: { ...menuDraft.draft_data, selections } });
        }
        useCreatorNavStore.getState().deliverMenuDrink(menuSectionId, id);
      }

      useRecentActivityStore.getState().push(recentEntry('cocktail', id, capitalize(draft.name), { barId }));
      void qc.invalidateQueries({ queryKey: ['cocktails'] });
      if (barId) void qc.invalidateQueries({ queryKey: ['bar', barId] });
      if (createdLookups) void qc.invalidateQueries({ queryKey: DROPDOWNS_QUERY_KEY });
      if (creatorId) void qc.invalidateQueries({ queryKey: ['profile-originals'] });
      return { id, warnings };
    },
    // The wizard says what went wrong itself, and keeps the draft.
    onError: () => {},
  });
}
