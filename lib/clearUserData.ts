import { FAVORITES_KEY } from '@/hooks/useFavorites';
import { STUDY_PILE_KEY } from '@/hooks/useStudyPile';
import { deviceStore } from '@/lib/deviceStore';
import { asyncStoragePersister, queryClient } from '@/lib/react-query';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';

/**
 * Forgets everything the signed-out user left on this device: cached query
 * data (in memory and persisted), recent activity, favorites and the study
 * pile. Bar iPads are shared, so the next person must not see any of it.
 */
export async function clearUserData(): Promise<void> {
  queryClient.clear();
  useRecentActivityStore.setState({ items: [] });
  await Promise.all([
    asyncStoragePersister.removeClient(),
    deviceStore.removeItem(FAVORITES_KEY),
    deviceStore.removeItem(STUDY_PILE_KEY),
  ]);
}
