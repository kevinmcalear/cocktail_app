import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { refreshIngredients } from '@/hooks/useDropdowns';
import { SHELF_KEY } from '@/hooks/useShelf';
import { recentEntry } from '@/hooks/useTrackRecent';
import { saveErrorWords } from '@/lib/saveErrorWords';
import { houseMadePayload } from '@/lib/houseMadeParts';
import { sameHouseMade } from '@/lib/houseMadeSame';
import type { HouseMadeDraft } from '@/lib/houseMadeDraft';
import type { PrepDraft } from '@/lib/prepKinds';
import { capitalizeFirst } from '@/lib/stringUtils';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/db';
import { toastDone } from '@/lib/toast';
import { useHouseMadeWizardStore } from '@/store/useHouseMadeWizardStore';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';

export interface SaveHouseMadeInput {
  name: string;
  prep: PrepDraft;
  barId: string | null;
  /** The draft's slot (lib/houseMadeDraft houseMadeSlot): cleared once it's in. */
  slot: string;
  /** The kept draft as Save was pressed: a save that waited clears it only if it's still that (one written in since stays). */
  kept?: HouseMadeDraft;
  /** Add to your bar's Make it in house: it goes on your bar too, offline as well. */
  shelf?: boolean;
  /** Saved with no signal (Save on this phone): it waits for signal and says so when it's in. */
  queued?: boolean;
}

const SAVE_HOUSE_MADE = ['save-house-made'];

/** Board Add-parts, 4: "Saved 3 house-mades. Each is on House-made with its own page and Used in." */
export const savedTogether = (count: number) => `Saved ${count} house-mades`;
export const PARTS_SAVED = 'Each is on House-made with its own page and Used in.';

/** This draft's save still waiting for signal: saving it again would add it twice. */
export function useHouseMadeWaiting(slot: string) {
  return useMutationState({
    filters: { mutationKey: SAVE_HOUSE_MADE, status: 'pending' },
    select: (m) => (m.state.variables as SaveHouseMadeInput | undefined)?.slot ?? null,
  }).some((s) => s === slot);
}

/**
 * Something you make, saved (board Add-house): the recipe, never renamed
 * (Name taken asks first), and its parts with it (board Add-parts), each its
 * own house-made, in one call: all of them or none. Offline it waits for
 * signal, like a beer or a wine, and the draft stays on the phone until it's in.
 */
export function useSaveHouseMade() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: SAVE_HOUSE_MADE,
    mutationFn: async ({ name, prep, barId, shelf }: SaveHouseMadeInput) => {
      const payload = houseMadePayload(name, prep);
      // p_bar is null at home: the function takes it (generated types call every argument required text).
      const { data, error } = await supabase.rpc('save_house_mades', { p_bar: barId as string, p_preps: payload as unknown as Json });
      if (error) throw error;
      const ids = data as string[];
      const made = { id: ids[0], name: payload[0].name, count: ids.length, warnings: [] as string[] };
      useRecentActivityStore.getState().push(recentEntry('ingredient', made.id, made.name, { barId }));
      void qc.invalidateQueries({ queryKey: ['ingredients'] });
      // Just the new house-mades into the pickers' lists, not the whole catalog again.
      void refreshIngredients(qc, ids).catch(() => {});
      if (barId) void qc.invalidateQueries({ queryKey: ['bar', barId] });
      if (shelf) {
        const { error } = await supabase.from('home_bar_items').upsert({ item_id: made.id }, { onConflict: 'user_id,item_id', ignoreDuplicates: true });
        if (error) made.warnings.push('It’s saved, but didn’t go on your bar. Add it from its page.');
        void qc.invalidateQueries({ queryKey: SHELF_KEY });
      }
      return made;
    },
    onSuccess: ({ warnings, count }, { name, slot, kept: asSaved, queued }) => {
      // Here, not on the screen: a save that waited for signal lands after the steps have closed.
      // ponytail: a wait cut short by closing the app loses the save, not the draft, which is still listed; setMutationDefaults would resume it.
      const store = useHouseMadeWizardStore.getState();
      const kept = store.kept[slot];
      if (kept && (!queued || !asSaved || sameHouseMade(kept.draft, asSaved))) store.clear(slot);
      void qc.invalidateQueries({ queryKey: ['same-name-prep'] });
      if (!queued) return;
      if (count > 1) toastDone(savedTogether(count), PARTS_SAVED);
      else toastDone('Recipe saved', capitalizeFirst(name.trim()));
      if (warnings.length) Alert.alert('Saved, with one thing to fix', warnings.join('\n\n'));
    },
    onError: (e, { name, barId, queued }) => {
      if (queued) Alert.alert(`Couldn’t save ${capitalizeFirst(name.trim())}`, `${saveErrorWords(e)} It’s still kept, under ${barId ? 'House-made, Drafts' : 'Pick up where you left off'}.`);
    },
  });
}
