import type { AsyncStorage, PersistedClient } from '@tanstack/query-persist-client-core';
import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';

/**
 * What's saved between launches: every successful query except those marked
 * `meta: { persist: false }`. That's ones keyed by where the person is
 * standing (hooks/useDiscover.ts), which must never be stored, and big lists
 * that are cheap to refetch: discover drinks, the Library ingredient list and
 * the spec dropdowns. The whole cache is one storage row, and Android can't
 * read a row over about 2 MB back (SQLite CursorWindow), so those three
 * (about 3.5 MB on the local stack) meant every Android launch started cold.
 */
export function shouldPersistQuery(query: Query): boolean {
  return defaultShouldDehydrateQuery(query) && query.meta?.persist !== false;
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
