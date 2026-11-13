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

/** Kept, or one that waited and is being sent now: stored until the database has answered, so a kill mid-send loses nothing. */
export const isStoredWrite = (write: AnyWrite) => isKeptWrite(write) || (write.state.status === 'pending' && waited.has(write));

// --- whose write it is ---
// A write is stamped with who was signed in when it was made (in its state, which is saved with it), and is
// never sent as anyone else: the Supabase client sends as whoever is signed in at send time.
let signedIn: string | null | undefined;
let settled: () => void = () => undefined;
const known = new Promise<void>((done) => {
  settled = done;
});
/** Who's signed in now, as auth settles (hooks/useUserCacheSync.ts). Undefined until it has. */
export const setWriteOwner = (userId: string | null | undefined) => {
  signedIn = userId;
  if (userId !== undefined) settled();
};
/** Resolves once auth has settled, so a stamped write is only checked against a known person. */
export const ownerKnown = () => known;
export const writeOwner = () => signedIn;
type Stamped = { owner?: string | null };
export const ownerOf = (write: AnyWrite): string | null | undefined => (write.state as Stamped).owner;
/** Stamps a new write with who's signed in (lib/react-query.ts, as it starts). */
export function stampOwner(write: AnyWrite): void {
  if (signedIn !== undefined) (write.state as Stamped).owner ??= signedIn;
}
/** Made by someone other than who's signed in now (both known). */
export const madeBySomeoneElse = (write: AnyWrite) => {
  const owner = ownerOf(write);
  return owner !== undefined && signedIn !== undefined && owner !== signedIn;
};

/** A write that didn't send, sent again as it was (from what's waiting to send). It waits for signal like the first try. */
export function resendWrite(client: QueryClient, write: AnyWrite): void {
  if (madeBySomeoneElse(write)) {
    client.getMutationCache().remove(write);
    return;
  }
  if (write.state.isPaused) {
    void client.resumePausedMutations();
    return;
  }
  const cache = client.getMutationCache();
  const again = cache.build(client, { mutationKey: write.options.mutationKey }) as AnyWrite;
  waited.add(again);
  (again.state as Stamped).owner = ownerOf(write);
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
    refetchAfterDiscard(client, write);
    // Writes queued behind it go now, not at the next reconnect.
    void client.resumePausedMutations();
  });
}

let refetchAfterDiscard: (client: QueryClient, write: AnyWrite) => void = () => undefined;
/** lib/react-query.ts says what a write touches (its BAR_WRITES refresh keys). */
export const setDiscardRefetch = (fn: typeof refetchAfterDiscard) => {
  refetchAfterDiscard = fn;
};

let saver: (queryKey: QueryKey) => Promise<void> = async () => undefined;
/** Saves a query kept in a file now, not at its next fetch: a change made on the phone (a run sheet's serves) is there after a relaunch. */
export const saveQueryNow = (queryKey: QueryKey) => saver(queryKey);
/** lib/react-query.ts says how (its file persister). */
export const setQuerySaver = (save: typeof saver) => {
  saver = save;
};
