import { useIsRestoring } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { cacheActionOnAuth, resetUserQueries } from '@/lib/authCache';
import { clearUserData } from '@/lib/clearUserData';
import { queryClient } from '@/lib/react-query';

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
 * Both wait for the saved cache to finish loading (PersistQueryClientProvider):
 * cleared or reset before that, the load would put the previous user's data
 * back in afterwards.
 */
export function useUserCacheSync() {
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
    if (action === 'clear') {
      clearUserData().catch((e) => console.warn('Clearing signed-out data failed', e));
    } else if (action === 'reset') {
      resetUserQueries(queryClient).catch((e) => console.warn('Refetching after sign-in failed', e));
    }
  }, [loading, userId, provisionalId, restoring]);
}
