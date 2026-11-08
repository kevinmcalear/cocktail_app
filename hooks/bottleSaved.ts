import type { QueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import type { BottleWrite } from '@/hooks/barWrites';
import { refreshIngredients } from '@/hooks/useDropdowns';
import { recentEntry } from '@/hooks/useTrackRecent';
import { toastDone } from '@/lib/toast';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';

/**
 * Once a bottle is in (hooks/barWrites.ts runs it from the write's own
 * variables, so a save kept on the phone through a relaunch gets the same):
 * recents, the pickers learn it, "Bottle saved" if it waited for signal, then
 * the label photo, a new bottle's only.
 */
export async function bottleSaved(qc: QueryClient, id: string, w: BottleWrite) {
  useRecentActivityStore.getState().push(recentEntry('ingredient', id, w.name, { barId: w.barId }));
  void refreshIngredients(qc, [id]).catch(() => {});
  if (w.queued) toastDone('Bottle saved', w.name);
  // One the database said was already shared (another id) keeps its own picture.
  if (!w.photo || w.existing || id !== w.id) return;
  // ponytail: the photo is the picker's file (in a phone's caches, which it may empty when short of space; on the web a
  // blob: URL that goes with the tab), so a save kept that long can lose it, and then it says so below. If that happens,
  // copy it into the app's documents (lib/fileStore's folder) when the save is queued.
  const photo = w.photo;
  await import('@/hooks/ingredientPicture')
    .then(({ saveIngredientPicture }) => saveIngredientPicture(qc, id, 'photo', photo))
    .catch(() => Alert.alert('The label photo didn’t save', 'The bottle is saved. Add the photo again on its page.'));
}
