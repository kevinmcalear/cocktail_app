import type { AsyncStorage, PersistedClient } from '@tanstack/query-persist-client-core';
import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';

/**
 * Query keys (by prefix) saved between launches: small, and what the first
 * screen paints from (who you are, your venues and mode, tonight's menus,
 * Discover's lists), plus drink pages you opened, so a spec still reads with
 * no signal behind the bar. A hook can opt in with `meta: { persist: true }`.
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
  ['menus-v2', 'venue-2'],
  ['home-bar'],
  ['collection'],
  ['drink-lists'],
  ['bar-cities'],
  ['discover-top-bars'],
  ['my-taste'],
  ['my-ranked-ids'],
  ['cocktail'],
];

const startsWith = (key: readonly unknown[], prefix: readonly string[]) => prefix.every((part, i) => key[i] === part);

/**
 * What's saved between launches: successful queries on the list above or
 * marked `meta: { persist: true }`, never one marked `persist: false` (keyed
 * by where the person is standing, hooks/useDiscover.ts). Everything else
 * refetches when its screen opens. The whole cache is one storage row,
 * Android can't read a row over about 2 MB back (SQLite CursorWindow), and a
 * smaller row restores faster on every launch.
 */
export function shouldPersistQuery(query: Query): boolean {
  if (!defaultShouldDehydrateQuery(query) || query.meta?.persist === false) return false;
  return query.meta?.persist === true || PERSISTED_KEYS.some((prefix) => startsWith(query.queryKey, prefix));
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
