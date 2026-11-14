import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { dropOthersWrite, isKeptWrite, madeBySomeoneElse, markWaited, ownerOf, refetchDiscarded, saveQueryNow, type AnyWrite } from '@/lib/keptWrites';

/*
 * Send and Discard on a write kept on this phone (components/UnsentWrites.tsx, Waiting to send). Apart from
 * lib/keptWrites.ts, which every page loads at start: these load with the card, when something is waiting.
 */

/** A write that didn't send, sent again as it was (from what's waiting to send). It waits for signal like the first try. */
export function resendWrite(client: QueryClient, write: AnyWrite): void {
  // One send per write at a time: a second tap (or Send while it's already going again) finds it sending or gone.
  if (!client.getMutationCache().getAll().includes(write) || !isKeptWrite(write)) return;
  if (madeBySomeoneElse(write)) {
    dropOthersWrite(client, write, 'resend');
    return;
  }
  if (write.state.isPaused) {
    void client.resumePausedMutations();
    return;
  }
  const cache = client.getMutationCache();
  const again = cache.build(client, { mutationKey: write.options.mutationKey }) as AnyWrite;
  markWaited(again);
  (again.state as { owner?: string | null }).owner = ownerOf(write);
  cache.remove(write);
  void again.execute(write.state.variables).catch(() => undefined);
}

/**
 * Gives up on a write that didn't send: what it would have changed is lost (the caller asks first).
 * What it showed ahead of time goes too: the copy it changed is put back (a run sheet's, from its
 * `{ key, before }`, saved with it, after a relaunch too), and what it touches is fetched again.
 */
export function discardWrite(client: QueryClient, write: AnyWrite): void {
  const undo = write.state.context as { key?: QueryKey; before?: unknown } | undefined;
  let saved = Promise.resolve();
  if (undo?.key && undo.before !== undefined) {
    client.setQueryData(undo.key, undo.before);
    saved = saveQueryNow(undo.key);
  }
  client.getMutationCache().remove(write);
  // Fetched again only once the file holds the copy put back: the refetch changes the query's state, and the
  // file saver skips a state that's no longer the query's, which left the change in the file for the next launch.
  void saved.finally(() => {
    refetchDiscarded(client, write);
    // Writes queued behind it go now, not at the next reconnect.
    void client.resumePausedMutations();
  });
}

