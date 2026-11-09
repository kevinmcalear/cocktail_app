import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { createPrep } from '@/hooks/usePrepCard';
import { SHELF_KEY } from '@/hooks/useShelf';
import { plainDbMessage } from '@/lib/dbError';
import { houseMadePlace } from '@/lib/houseMadeDraft';
import type { PrepDraft } from '@/lib/prepKinds';
import { capitalizeFirst } from '@/lib/stringUtils';
import { supabase } from '@/lib/supabase';
import { toastDone } from '@/lib/toast';
import { useHouseMadeWizardStore } from '@/store/useHouseMadeWizardStore';

export interface SaveHouseMadeInput {
  name: string;
  prep: PrepDraft;
  barId: string | null;
  /** When the kept draft last changed: it's cleared once this is in only if nothing changed since (a draft picked up again while it waited stays). */
  keptAt?: number;
  /** Add to your bar's Make it in house: it goes on your bar too, offline as well. */
  shelf?: boolean;
  /** Saved with no signal (Save on this phone): it waits for signal and says so when it's in. */
  queued?: boolean;
}

const SAVE_HOUSE_MADE = ['save-house-made'];

/** A save from this place still waiting for signal: saving it again would add it twice. */
export function useHouseMadeWaiting(barId: string | null) {
  return useMutationState({
    filters: { mutationKey: SAVE_HOUSE_MADE, status: 'pending' },
    select: (m) => (m.state.variables as SaveHouseMadeInput | undefined)?.barId ?? null,
  }).some((b) => b === barId);
}

/**
 * Something you make, saved (board Add-house): the recipe, never renamed
 * (Name taken asks first). Offline it waits for signal, like a beer or a
 * wine, and the draft stays on the phone until it's in.
 */
export function useSaveHouseMade() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: SAVE_HOUSE_MADE,
    mutationFn: async ({ name, prep, barId, shelf }: SaveHouseMadeInput) => {
      const made = await createPrep(qc, { name, prep, barId, exact: true });
      if (shelf) {
        const { error } = await supabase.from('home_bar_items').upsert({ item_id: made.id }, { onConflict: 'user_id,item_id', ignoreDuplicates: true });
        if (error) made.warnings.push('It’s saved, but didn’t go on your bar. Add it from its page.');
        void qc.invalidateQueries({ queryKey: SHELF_KEY });
      }
      return made;
    },
    onSuccess: ({ warnings }, { name, barId, keptAt, queued }) => {
      // Here, not on the screen: a save that waited for signal lands after the steps have closed.
      // ponytail: a wait cut short by closing the app loses the save, not the draft, which is still listed; setMutationDefaults would resume it.
      const store = useHouseMadeWizardStore.getState();
      const place = houseMadePlace(barId);
      const kept = store.kept[place];
      if (kept && (keptAt === undefined || kept.updatedAt <= keptAt)) store.clear(place);
      void qc.invalidateQueries({ queryKey: ['same-name-prep'] });
      if (!queued) return;
      toastDone('Recipe saved', capitalizeFirst(name.trim()));
      if (warnings.length) Alert.alert('Saved, with one thing to fix', warnings.join('\n\n'));
    },
    onError: (e, { name, barId, queued }) => {
      if (queued) Alert.alert(`Couldn’t save ${capitalizeFirst(name.trim())}`, `${plainDbMessage(e) ?? e.message} It’s still kept, under ${barId ? 'House-made, Drafts' : 'Pick up where you left off'}.`);
    },
  });
}
