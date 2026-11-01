import AsyncStorage from '@react-native-async-storage/async-storage';
import { FAVORITES_KEY } from '@/hooks/useFavorites';
import { ACCOUNT_ALLERGIES_KEY } from '@/hooks/useGuestAllergies';
import { STUDY_PILE_KEY } from '@/hooks/useStudyPile';
import { AI_CONSENT_KEY } from '@/lib/aiConsent';
import { dropUnsentWrites, isUserQuery } from '@/lib/authCache';
import { deviceStore } from '@/lib/deviceStore';
import { asyncStoragePersister, queryClient, savedQueryFiles } from '@/lib/react-query';
import { clearSavedSpecBooks } from '@/lib/specBookFile';
import { useAppMode } from '@/store/useAppMode';
import { useBeerWineWizardStore } from '@/store/useBeerWineWizardStore';
import { useBringIn } from '@/store/useBringIn';
import { useDraftSyncStore } from '@/store/useDraftSyncStore';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';
import { useLastPlace } from '@/store/useLastPlace';
import { useNoteDrafts } from '@/store/useNoteDrafts';
import { useOfflineEdits } from '@/store/useOfflineEdits';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';
import { useVenueSetup } from '@/store/useVenueSetup';

/**
 * Forgets everything the signed-out user left on this device: cached query
 * data (in memory, the saved row and the saved query files), the venues'
 * spec books, edits made offline and not yet sent, recent
 * activity, favorites and the study pile, AI consent, this phone's copy of their account's allergies, the last near-me place, the
 * venue they were working in and its setup progress, drinks and bottles half added, big imports
 * waiting to be reviewed, and notes to us not yet sent. Bar iPads are shared,
 * so the next person must not see any of it, or send it as themselves.
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
  useDrinkWizardStore.setState({ kept: {}, cleared: [] });
  useDraftSyncStore.setState({ seen: [] });
  useBeerWineWizardStore.setState({ kept: {} });
  // Glasses held for a venue's page stay: they're the venue's list, not the person's, and only someone with
  // Prep there puts them on the page. Signing out used to lose them for good.
  useVenueSetup.setState({ runs: {} });
  useNoteDrafts.setState({ drafts: {} });
  // Spec edits kept on this phone with no signal: never sent as the next person.
  useOfflineEdits.setState({ edits: {} });
  useBringIn.setState({ reviews: {}, reviewing: null, later: [] });
  await Promise.all([
    asyncStoragePersister.removeClient(),
    savedQueryFiles.clear(),
    clearSavedSpecBooks(),
    deviceStore.removeItem(FAVORITES_KEY),
    deviceStore.removeItem(STUDY_PILE_KEY),
    deviceStore.removeItem(AI_CONSENT_KEY),
    // Their allergies stay on their account; the next person on a shared phone never sees them. This also runs
    // on opening the app signed out, so the signed-out guest's own list (GUEST_ALLERGIES_KEY) stays.
    deviceStore.removeItem(ACCOUNT_ALLERGIES_KEY),
    // The old step-by-step ingredient wizard's kept draft (gone since A bottle you buy).
    AsyncStorage.removeItem('ingredient-wizard'),
  ]);
}
