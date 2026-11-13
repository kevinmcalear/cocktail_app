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

// --- reading the row back ---

/** Where writes that couldn't be read back are set aside: kept on the phone as they were, never sent, never in the way. */
export const SET_ASIDE_KEY = 'REACT_QUERY_SET_ASIDE';

type Saved = { mutationKey?: unknown; state?: { status?: unknown; isPaused?: unknown; variables?: unknown; submittedAt?: unknown; owner?: unknown } };
const STATUSES = ['idle', 'pending', 'error', 'success'];
const UNREAD = 'It couldn’t be read back after the app closed. Send it again, or discard it.';

/**
 * A saved row's writes, checked before they're restored: one whole is kept; one this app can still send but whose
 * state is broken comes back as didn't send (its variables kept, listed on Tonight); anything else is set aside.
 * Broken queries just go (they're fetched again). `canSend` says a key has a registered mutationFn.
 */
export function checkSavedWrites(row: PersistedClient, canSend: (key: readonly unknown[]) => boolean): { row: PersistedClient; setAside: unknown[] } {
  const setAside: unknown[] = [];
  const mutations: unknown[] = [];
  const saved: unknown = row.clientState?.mutations;
  for (const m of (Array.isArray(saved) ? saved : []) as (Saved | null)[]) {
    const key = m?.mutationKey;
    const sendable = Array.isArray(key) && canSend(key);
    const state = m?.state && typeof m.state === 'object' ? m.state : undefined;
    if (sendable && state && STATUSES.includes(state.status as string) && typeof state.isPaused === 'boolean') mutations.push(m);
    else if (sendable && state && state.variables !== undefined)
      mutations.push({
        ...m,
        state: {
          context: undefined,
          data: undefined,
          error: { message: UNREAD },
          failureCount: 0,
          failureReason: null,
          isPaused: false,
          status: 'error',
          variables: state.variables,
          submittedAt: Number(state.submittedAt) || Date.now(),
          ...(state.owner !== undefined ? { owner: state.owner } : {}),
        },
      });
    else setAside.push(m);
  }
  const queries: unknown = row.clientState?.queries;
  const whole = (Array.isArray(queries) ? queries : []).filter(
    (q: Partial<PersistedQuery> | null) => !!q && Array.isArray(q.queryKey) && typeof q.queryHash === 'string' && !!q.state && typeof q.state === 'object',
  );
  return { row: { ...row, clientState: { mutations, queries: whole } as PersistedClient['clientState'] }, setAside };
}

/** The row "Waiting to send" lists for a batch set aside (lib/unsentRows.ts): didn't send, Discard drops the batch. */
export const SET_ASIDE_WRITE = ['bar-write', 'set-aside'] as const;
const SET_ASIDE_WHY = 'This phone couldn’t read them back after the app closed, so they can’t be sent. Make them again, then discard this.';
type Batch = { at: number; items: unknown };

/** Every batch set aside so far: each is kept until it's discarded or the person signs out (lib/clearUserData.ts). */
async function readBatches(storage: AsyncStorage<string>): Promise<Batch[]> {
  const raw = await Promise.resolve(storage.getItem(SET_ASIDE_KEY)).catch(() => null);
  if (!raw) return [];
  try {
    const kept: unknown = JSON.parse(raw);
    // One from the first build of this kept a single batch.
    return Array.isArray(kept) ? (kept as Batch[]) : [kept as Batch];
  } catch {
    return [{ at: 0, items: raw }];
  }
}

/** Drops one batch, discarded from "Waiting to send". */
export async function dropSetAside(storage: AsyncStorage<string>, at: number): Promise<void> {
  const left = (await readBatches(storage)).filter((b) => b.at !== at);
  await Promise.resolve(left.length ? storage.setItem(SET_ASIDE_KEY, JSON.stringify(left)) : storage.removeItem(SET_ASIDE_KEY)).catch(() => undefined);
}

/** The row for a batch: refused, stamped with whoever made the writes in it when that's one person. */
function setAsideRow(at: number, items: unknown) {
  const owners = new Set((Array.isArray(items) ? items : []).map((m: Saved | null) => m?.state?.owner).filter((o) => o !== undefined));
  const count = Array.isArray(items) ? items.length : 0;
  return {
    mutationKey: [...SET_ASIDE_WRITE],
    state: {
      context: undefined,
      data: undefined,
      error: { message: SET_ASIDE_WHY },
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      status: 'error',
      variables: { at, count },
      submittedAt: at,
      ...(owners.size === 1 ? { owner: [...owners][0] } : {}),
    },
  };
}

/**
 * Reads the row back without ever stopping the app opening: what can't be read (corrupt, or too big to read) is
 * set aside as it was, reported, and the app opens without it; broken writes are sorted by checkSavedWrites.
 * Each batch set aside is added to the others, and listed in "Waiting to send" as didn't send, so it's seen and
 * can be discarded. ponytail: a row too big to read can't be read to set aside either: reported only.
 */
export async function restoreRowSafely(
  storage: AsyncStorage<string>,
  persister: Persister,
  canSend: (key: readonly unknown[]) => boolean,
  report: (e: unknown, about: Record<string, unknown>) => void,
  buster: string,
): Promise<PersistedClient | undefined> {
  const setAside = async (items: unknown) => {
    const at = Date.now();
    const batches = [...(await readBatches(storage)), { at, items }];
    await Promise.resolve(storage.setItem(SET_ASIDE_KEY, JSON.stringify(batches))).catch(() => undefined);
    return setAsideRow(at, items);
  };
  try {
    const row = await persister.restoreClient();
    if (!row) return row;
    const checked = checkSavedWrites(row, canSend);
    if (checked.setAside.length) {
      checked.row.clientState.mutations.push((await setAside(checked.setAside)) as unknown as PersistedClient['clientState']['mutations'][number]);
      report(new Error('Saved writes set aside: unreadable'), { count: checked.setAside.length });
    }
    return checked.row;
  } catch (e) {
    const raw = await Promise.resolve(storage.getItem(ROW_KEY)).catch(() => null);
    await Promise.resolve(storage.removeItem(ROW_KEY)).catch(() => undefined);
    report(e, { where: 'restore', setAside: !!raw });
    if (!raw) return undefined;
    // The app opens with nothing from the row but the line saying what was set aside.
    const mutations = [await setAside(raw)] as unknown as PersistedClient['clientState']['mutations'];
    return { timestamp: Date.now(), buster, clientState: { mutations, queries: [] } };
  }
}
