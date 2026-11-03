import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  experimental_createQueryPersister,
  type AsyncStorage,
  type PersistedClient,
  type PersistedQuery,
  type Persister,
} from '@tanstack/query-persist-client-core';
import { defaultShouldDehydrateQuery, type Query, type QueryCache } from '@tanstack/react-query';

import type { FileStore } from '@/lib/fileStore';
import { DROPDOWNS_QUERY_KEY } from '@/lib/queryDefaults';

/**
 * Query keys (by prefix) saved in the one storage row, read back before the
 * first screen paints: small, and what that screen paints from (who you
 * are, your venues and mode, tonight's menus, Discover's lists).
 */
export const PERSISTED_KEYS: readonly (readonly string[])[] = [
  ['bars'],
  ['viewAs'],
  ['capabilities'],
  ['venue-brand'],
  ['venue-branding'],
  ['age-check'],
  ['am-i-moderator'],
  ['profile', 'mine'],
  // Tonight's and the Menus tab's list (hooks/useMenus.ts menuKeys.venue).
  ['menus-v2', 'venue-7'],
  // The Library's menus and your drafts, so it paints from the saved cache.
  [DROPDOWNS_QUERY_KEY[0], 'menus'],
  ['drafts'],
  ['home-bar'],
  ['drink-lists'],
  // Drawing inputs (hooks/useItemSketch.ts): a few hundred bytes a drink, so Tonight and a menu draw at once after a launch. Largest-first dropping keeps them last to go when the row is full.
  ['item-sketch'],
  ['bar-cities'],
  ['discover-top-bars'],
  ['flavor-baseline'],
];

/**
 * Query keys (by prefix) saved in a file each (lib/fileStore.ts) and read back
 * when the query first runs: drink and ingredient pages you opened, so a spec
 * still reads with no signal behind the bar, and your collection and what
 * you've had, which your taste is built from. A hook opts in with
 * `meta: { persist: true }` (the Library's venue lists, the spec lists).
 */
export const FILE_KEYS: readonly (readonly string[])[] = [['cocktail'], ['ingredient'], ['collection'], ['my-had']];

const startsWith = (key: readonly unknown[], prefix: readonly string[]) => prefix.every((part, i) => key[i] === part);

/**
 * Where a query is saved between launches: in the row (the first screen),
 * in a file of its own, or not at all. `persist: false` always wins (keyed
 * by where the person is standing, hooks/useDiscover.ts). Everything else
 * refetches when its screen opens.
 */
export function savedIn(query: Pick<Query, 'queryKey' | 'meta'>): 'row' | 'file' | null {
  if (query.meta?.persist === false) return null;
  if (PERSISTED_KEYS.some((prefix) => startsWith(query.queryKey, prefix))) return 'row';
  if (query.meta?.persist === true || FILE_KEYS.some((prefix) => startsWith(query.queryKey, prefix))) return 'file';
  return null;
}

/**
 * What goes in the row: successful queries saved there. The row is one
 * AsyncStorage value, Android can't read one over about 2 MB back (SQLite
 * CursorWindow), and a smaller row restores faster on every launch, so
 * anything big or numerous is a file instead.
 */
export function shouldPersistQuery(query: Query): boolean {
  return defaultShouldDehydrateQuery(query) && savedIn(query) === 'row';
}

/**
 * Size cap for the saved cache, in characters. Android's limit is 2 MB of
 * UTF-8; the cache is almost all ASCII, so this leaves room for accents.
 */
export const MAX_CACHE_CHARS = 1_500_000;

/**
 * JSON for storage, dropping the largest queries first when it would be over
 * `max`, so a new big list can't push the row past what Android reads back.
 */
export function serializeCache(client: PersistedClient, max = MAX_CACHE_CHARS): string {
  const full = JSON.stringify(client);
  if (full.length <= max) return full;

  const queries = client.clientState.queries;
  const sizes = queries.map((q) => JSON.stringify(q).length + 1); // + its comma
  const largestFirst = queries.map((_, i) => i).sort((a, b) => sizes[b] - sizes[a]);
  const dropped = new Set<number>();
  let size = full.length;
  for (const i of largestFirst) {
    if (size <= max) break;
    dropped.add(i);
    size -= sizes[i];
  }
  return JSON.stringify({
    ...client,
    clientState: { ...client.clientState, queries: queries.filter((_, i) => !dropped.has(i)) },
  });
}

/**
 * Storage whose reads can't fail: a row that won't read back (too big, or
 * corrupt) is deleted and treated as empty, so the app starts cold instead of
 * erroring at launch.
 */
export function guardStorage(storage: AsyncStorage<string>): AsyncStorage<string> {
  return {
    getItem: async (key) => {
      try {
        return await storage.getItem(key);
      } catch (e) {
        console.warn('Saved query cache unreadable, starting fresh', e);
        await Promise.resolve(storage.removeItem(key)).catch(() => undefined);
        return null;
      }
    },
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key),
  };
}

/**
 * The library's throttled persister, except a snapshot of the cache taken
 * before the saved cache was last removed is never written. A save
 * serializes its snapshot, then writes it a tick later; when sign-out
 * removes the saved cache in that gap, the write would put the previous
 * user's data straight back until the next throttled save. Bar iPads are
 * shared, and the app can be closed in between.
 */
export function createCachePersister(storage: AsyncStorage<string>, throttleTime: number): Persister & { saveNow: (client: PersistedClient) => Promise<void> } {
  let removals = 0;
  const takenAfter = new WeakMap<PersistedClient, number>();
  let saving: number | undefined;
  const persister = createAsyncStoragePersister({
    storage: {
      getItem: (key) => storage.getItem(key),
      // Saves run one at a time, so `saving` is this value's snapshot's.
      setItem: async (key, value) => {
        if (saving === removals) await storage.setItem(key, value);
      },
      removeItem: (key) => {
        removals++;
        return storage.removeItem(key);
      },
    },
    serialize: (client) => {
      saving = takenAfter.get(client);
      return serializeCache(client);
    },
    throttleTime,
  });
  return {
    ...persister,
    persistClient: (client) => {
      takenAfter.set(client, removals);
      return persister.persistClient(client);
    },
    /** Saves at once, past the throttle: a write waiting for signal must not be lost to the app closing in those seconds. */
    saveNow: async (client) => {
      const taken = removals;
      const value = serializeCache(client);
      if (taken === removals) await storage.setItem(ROW_KEY, value);
    },
  };
}

/** The row's storage key (the library's default). */
const ROW_KEY = 'REACT_QUERY_OFFLINE_CACHE';

/** A short, file-safe name for a query hash (53-bit cyrb53, in base 36). */
export function fileNameFor(queryHash: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < queryHash.length; i++) {
    const ch = queryHash.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Saves each query marked for a file (savedIn) in a file of its own after it
 * fetches, and reads it back the first time the query runs with nothing in
 * memory: the page paints from it, then refreshes if it's stale. No size
 * cap, since no file shares a row. A snapshot is only written while it is
 * still the live state of a query in `cache`: one that lands after sign-out
 * removed its query would put the last person's data back on a shared iPad.
 */
export function createFilePersister(files: FileStore, cache: QueryCache, { maxAge, buster }: { maxAge: number; buster: string }) {
  const PREFIX = 'q';
  const nameOf = (storageKey: string) => fileNameFor(storageKey.slice(PREFIX.length + 1));
  return experimental_createQueryPersister<PersistedQuery>({
    storage: {
      getItem: async (key) => {
        const value = (await files.read(nameOf(key))) as PersistedQuery | null;
        // Two hashes that share a name: not this query's file.
        return value && `${PREFIX}-${value.queryHash}` === key ? value : null;
      },
      setItem: (key, value) => (cache.get(value.queryHash)?.state === value.state ? files.write(nameOf(key), value) : undefined),
      removeItem: (key) => files.remove(nameOf(key)),
    },
    serialize: (query) => query,
    deserialize: (query) => query,
    prefix: PREFIX,
    maxAge,
    buster,
    filters: { predicate: (query) => savedIn(query) === 'file' },
  });
}

/** Deletes saved query files past `maxAge` or from another app version. Run when the app is idle. */
export async function pruneQueryFiles(files: FileStore, { maxAge, buster }: { maxAge: number; buster: string }, now = Date.now()): Promise<void> {
  for (const name of await files.names()) {
    const query = (await files.read(name)) as PersistedQuery | null;
    const age = now - (query?.state?.dataUpdatedAt ?? 0);
    if (!query || query.buster !== buster || age > maxAge) await files.remove(name);
  }
}
