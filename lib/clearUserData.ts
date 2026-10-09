import { FAVORITES_KEY } from '@/hooks/useFavorites';
import { STUDY_PILE_KEY } from '@/hooks/useStudyPile';
import { AI_CONSENT_KEY } from '@/lib/aiConsent';
import { dropUnsentWrites, isUserQuery } from '@/lib/authCache';
import { deviceStore } from '@/lib/deviceStore';
import { asyncStoragePersister, queryClient } from '@/lib/react-query';
import { useAppMode } from '@/store/useAppMode';
import { useBeerWineWizardStore } from '@/store/useBeerWineWizardStore';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';
import { useIngredientWizardStore } from '@/store/useIngredientWizardStore';
import { useLastPlace } from '@/store/useLastPlace';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';

/**
 * Forgets everything the signed-out user left on this device: cached query
 * data (in memory and persisted), edits made offline and not yet sent, recent
 * activity, favorites and the study pile, AI consent, the last near-me place, the
 * venue they were working in, and drinks and bottles half added. Bar iPads are
 * shared, so the next person must not see any of it, or send it as themselves.
 */
export async function clearUserData(): Promise<void> {
  // Queries marked public (a venue's staff-link branding) aren't the user's,
  // and a signed-out page may be fetching one right now: removing a query
  // mid-fetch leaves that page loading forever.
  queryClient.removeQueries({ predicate: isUserQuery });
  dropUnsentWrites(queryClient);
  useRecentActivityStore.setState({ items: [] });
  useLastPlace.getState().clear();
  useAppMode.getState().forgetVenue();
  useDrinkWizardStore.setState({ kept: {} });
  useIngredientWizardStore.setState({ kept: {} });
  useBeerWineWizardStore.setState({ kept: {} });
  await Promise.all([
    asyncStoragePersister.removeClient(),
    deviceStore.removeItem(FAVORITES_KEY),
    deviceStore.removeItem(STUDY_PILE_KEY),
    deviceStore.removeItem(AI_CONSENT_KEY),
  ]);
}
