import NetInfo from '@react-native-community/netinfo';
import { onlineManager, type QueryClient } from '@tanstack/react-query';

import { dropOthersWrite, madeBySomeoneElse, ownerKnown, ownerOf, writeOwner, type AnyWrite } from '@/lib/keptWrites';

/**
 * Sends the writes a relaunch brought back (lib/react-query.ts resumeSavedWrites), loaded only when there are
 * any. Never awaited by the restore: the first screen doesn't wait on a send (no signal, wifi with no internet,
 * or a write stuck behind another), and auth only settles once the restore has ended (hooks/useUserCacheSync.ts).
 */
export async function sendRestored(client: QueryClient, restored: AnyWrite[]): Promise<void> {
  // Stamped with who made them: sent once who's signed in is known, anyone else's dropped.
  if (writeOwner() === undefined && restored.some((write) => ownerOf(write) !== undefined)) await ownerKnown();
  for (const write of restored) if (madeBySomeoneElse(write)) dropOthersWrite(client, write, 'relaunch');
  // onlineManager says online until NetInfo's first event, which can land
  // after the restore: ask first, or a write sent with no signal fails and is lost.
  const { isConnected } = await NetInfo.fetch();
  onlineManager.setOnline(!!isConnected);
  const cache = client.getMutationCache();
  // One killed while it was sending comes back neither paused nor running, and it's first in its line: it goes
  // again first (a drink resends what it froze, hooks/useCreateDrink.ts), and the ones paused behind it follow in order.
  for (const write of restored) if (cache.getAll().includes(write) && write.state.status === 'pending' && !write.state.isPaused) void write.continue().catch(() => undefined);
  void client.resumePausedMutations();
}
