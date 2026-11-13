import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsRestoring } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { useDraftSync } from '@/hooks/useDraftSync';
import { cacheActionOnAuth, resetUserQueries } from '@/lib/authCache';
import { clearUserData } from '@/lib/clearUserData';
import { setWriteOwner } from '@/lib/keptWrites';
import { SET_ASIDE_KEY } from '@/lib/queryCachePersist';
import { queryClient, savedQueryFiles } from '@/lib/react-query';
import { clearSavedSpecBooks } from '@/lib/specBookFile';

/**
 * Keeps the query cache to the signed-in user. Signed out (button, expiry or
 * another tab), or opened signed out: forget the previous user's cached data.
 * Bar iPads are shared. Signed in as someone new: refetch everything, since
 * screens mounted under the sign-in page (and requests racing the sign-in)
 * cached what anon may see.
 *
 * At launch, screens may paint the saved session's user's cache before auth
 * settles (ctx/AuthContext.tsx). That user counts as the one the cache was
 * shown for, so settling on anyone else resets it and settling on nobody
 * clears it.
 *
 * A new person also loses the saved query files and spec books, which were
 * fetched as the last one. Both wait for the saved cache to finish loading (PersistQueryClientProvider):
 * cleared or reset before that, the load would put the previous user's data
 * back in afterwards.
 */
export function useUserCacheSync() {
  // Drinks half made in the wizard, kept in the account for the same user (hooks/useDraftSync).
  useDraftSync();
  const { session, user, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const provisionalId = loading ? (user?.id ?? null) : null;
  const restoring = useIsRestoring();
  const shownUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (loading) {
      if (provisionalId) shownUserId.current = provisionalId;
      return;
    }
    if (restoring) return;
    const action = cacheActionOnAuth(shownUserId.current, userId);
    shownUserId.current = userId;
    // Writes made from now on are this person's, and saved ones are only sent as their maker (lib/keptWrites.ts).
    setWriteOwner(userId);
    if (action === 'clear') {
      clearUserData().catch((e) => console.warn('Clearing signed-out data failed', e));
    } else if (action === 'reset') {
      // The saved files first: a query reset reads its file back as it refetches.
      (async () => {
        // Writes set aside at launch go with the rest of the last person's writes (resetUserQueries).
        await Promise.all([savedQueryFiles.clear(), clearSavedSpecBooks(), AsyncStorage.removeItem(SET_ASIDE_KEY)]);
        await resetUserQueries(queryClient);
      })().catch((e) => console.warn('Refetching after sign-in failed', e));
    }
  }, [loading, userId, provisionalId, restoring]);
}
