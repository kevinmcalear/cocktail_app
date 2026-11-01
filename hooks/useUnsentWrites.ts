import { useMutationState, type MutationKey } from '@tanstack/react-query';

import { BAR_WRITE } from '@/lib/offlineWrites';

/**
 * Writes saved on this phone and waiting for signal (lib/offlineWrites.ts),
 * newest last: what each sends, and when it was made. Every behind-the-bar
 * write by default, or one kind (BAR_WRITES.zoneCount.key). A screen shows
 * them as pending ("Saved on this phone. It sends when there's signal.").
 */
export function useUnsentWrites<V = unknown>(mutationKey: MutationKey = [BAR_WRITE]) {
  return useMutationState({
    filters: { mutationKey, predicate: (m) => m.state.isPaused },
    select: (m) => ({ variables: m.state.variables as V, at: m.state.submittedAt }),
  });
}
