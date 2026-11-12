import type { Mutation, QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Writes kept on the phone until they're in (lib/react-query.ts keeps them,
 * hooks/useUnsentWrites lists them): apart from the client's own file so
 * screens and hooks can use them without loading the client's setup.
 */
export type AnyWrite = Mutation<unknown, Error, unknown, unknown>;

/**
 * Writes that waited on the phone at some point, or came back from a
 * relaunch: one the database refuses stays, listed as didn't send, instead of
 * being dropped. One refused while its screen is open is the screen's to say.
 */
const waited = new WeakSet<AnyWrite>();
export const markWaited = (write: AnyWrite) => void waited.add(write);
export const hasWaited = (write: AnyWrite) => waited.has(write);

/** Not in yet and kept on the phone: waiting for signal, or refused after it waited. */
export function isKeptWrite(write: AnyWrite): boolean {
  return write.state.isPaused || (write.state.status === 'error' && waited.has(write));
}

/** A write that didn't send, sent again as it was (from what's waiting to send). It waits for signal like the first try. */
export function resendWrite(client: QueryClient, write: AnyWrite): void {
  if (write.state.isPaused) {
    void client.resumePausedMutations();
    return;
  }
  const cache = client.getMutationCache();
  const again = cache.build(client, { mutationKey: write.options.mutationKey }) as AnyWrite;
  waited.add(again);
  cache.remove(write);
  void again.execute(write.state.variables).catch(() => undefined);
}

/** Gives up on a write that didn't send: what it would have changed is lost (the caller asks first). */
export function discardWrite(client: QueryClient, write: AnyWrite): void {
  client.getMutationCache().remove(write);
  // Writes queued behind it go now, not at the next reconnect.
  void client.resumePausedMutations();
}

let saver: (queryKey: QueryKey) => Promise<void> = async () => undefined;
/** Saves a query kept in a file now, not at its next fetch: a change made on the phone (a run sheet's serves) is there after a relaunch. */
export const saveQueryNow = (queryKey: QueryKey) => saver(queryKey);
/** lib/react-query.ts says how (its file persister). */
export const setQuerySaver = (save: typeof saver) => {
  saver = save;
};
