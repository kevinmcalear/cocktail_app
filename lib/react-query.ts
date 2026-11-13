import { BAR_WRITES } from '@/hooks/barWrites';
import { deleteCocktailFn, updateCocktailFn } from '@/hooks/useCocktails';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { dehydrate, focusManager, type Mutation, MutationCache, type QueryKey, notifyManager, onlineManager, QueryCache, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { coalesceTimer } from '@/lib/coalesceTimer';
import { loadDrinkSave, loadMadeForSection } from '@/lib/drinkSaveLoader';
import {
  hasWaited,
  isKeptWrite,
  isStoredWrite,
  madeBySomeoneElse,
  markWaited,
  ownerKnown,
  ownerOf,
  dropOthersWrite,
  setDiscardRefetch,
  setWritesSaver,
  setQuerySaver,
  stampOwner,
  writeOwner,
  type AnyWrite,
} from '@/lib/keptWrites';
import { fileStore } from '@/lib/fileStore';
import {
  createCachePersister,
  createFilePersister,
  FILE_KEYS,
  guardStorage,
  PERSISTED_KEYS,
  dropSetAside,
  pruneQueryFiles,
  restoreRowSafely,
  SET_ASIDE_WRITE,
  shouldPersistQuery,
} from '@/lib/queryCachePersist';
import { reportError } from '@/lib/monitoring';
import { BASE, KEEP, queryDefaults } from '@/lib/queryDefaults';
import { retryDelay, retryQuery } from '@/lib/queryRetry';
import { BAR_WRITE, isNetworkError, MENU_LAYOUT, NEW_DRINK, OFFLINE_SCOPE, retryBarWrite } from '@/lib/offlineWrites';
import type { CreateDrinkInput, CreateDrinkResult } from '@/hooks/useCreateDrink';
import type { MenuLayoutWrite } from '@/hooks/barWrites';
import { loadSavedSpecBooks } from '@/lib/specBookFile';

// The database didn't answer though the device is connected (wifi with no internet, below): offline
// until it does, whatever NetInfo says meanwhile.
let unreachable = false;

// Setup network listener for TanStack Query
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected && !unreachable);
  });
});

// --- wifi with no internet ---
// NetInfo says connected, but a write's dropped connection says otherwise: one look at the database's
// address settles it. Not there, and the app counts as offline (writes wait, the pill shows) until it is.
// ponytail: a request that gets no reply at all still waits for the platform's own timeout before it
// fails; the upgrade is a timeout on the Supabase client's fetch for writes.
const PROBE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/health` : null;
let probing = false;
async function reachable(url: string): Promise<boolean> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 5000);
  try {
    // Any answer will do (no-cors: the web can't read it, and needn't).
    await fetch(url, { mode: 'no-cors', signal: stop.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
function checkReachable() {
  const url = PROBE_URL;
  if (!url || probing || !onlineManager.isOnline()) return;
  probing = true;
  void (async () => {
    try {
      if (await reachable(url)) return;
      unreachable = true;
      onlineManager.setOnline(false);
      // Looked at again until it answers, or the device is offline for real (NetInfo says when it's back).
      for (;;) {
        await new Promise((done) => setTimeout(done, 10_000));
        if (!(await NetInfo.fetch()).isConnected) return;
        if (await reachable(url)) return onlineManager.setOnline(true);
      }
    } finally {
      unreachable = false;
      probing = false;
    }
  })();
}
/** A behind-the-bar write's tries: a dropped connection also checks the database is there, so it waits rather than retrying for half a minute. */
const retryWrite = (count: number, error: Error) => {
  if (isNetworkError(error)) checkReachable();
  return retryBarWrite(count, error);
};

// On iOS and Android "focus" is the app coming back to the foreground (the
// browser's tab focus doesn't exist there), so stale queries on screen
// refresh when someone returns to the app.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
    return () => sub.remove();
  });
}

// Every query result that lands in one tick reaches the screen in one commit (lib/coalesceTimer.ts).
notifyManager.setScheduler(coalesceTimer());

/**
 * What's saved between launches lasts a week, not the 24 h default: opening
 * the app after a weekend paints the last results at once and refreshes
 * behind them. A new app version starts clean, since its query shapes may
 * differ (an OTA bumps a key instead).
 */
const SAVED = { maxAge: KEEP, buster: Constants.expoConfig?.version ?? '' };

const queryCache = new QueryCache();
/** Queries saved in a file each (lib/queryCachePersist.ts savedIn), on the phone or in the browser's IndexedDB. */
export const savedQueryFiles = fileStore('query-cache');
const queryFiles = createFilePersister(savedQueryFiles, queryCache, SAVED);
// A change made on the phone to a query kept in a file is saved at once (lib/keptWrites.ts saveQueryNow).
setQuerySaver((queryKey) => queryFiles.persistQueryByKey(queryKey, queryClient).catch(() => undefined));

// A write of yours changes what the venues' spec books hold: refresh them
// once the writes go quiet (hooks/useSpecBook.ts).
let bookRefresh: ReturnType<typeof setTimeout> | undefined;
const refreshSpecBooksSoon = () => {
  clearTimeout(bookRefresh);
  bookRefresh = setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['spec-book'] }), 2000);
};

// Behind-the-bar writes that waited are kept until they're in, even refused (lib/keptWrites.ts); the rest go once settled.
const isBarWrite = (write: AnyWrite) => write.options.mutationKey?.[0] === BAR_WRITE;
const isNewDrink = (write: AnyWrite) => isBarWrite(write) && write.options.mutationKey?.[1] === NEW_DRINK[1];
const isMenuLayout =(write: AnyWrite) => isBarWrite(write) && write.options.mutationKey?.[1] === MENU_LAYOUT[1];
const later = (fn: () => void) => setTimeout(fn, 0);

const mutationCache = new MutationCache({
  // A menu's layout is sent whole: a newer one replaces any of that menu's still kept (waiting or refused), so
  // ten edits offline are one send, and an older one sent again later can't undo a newer one.
  onMutate: (v, write) => {
    if (isBarWrite(write as AnyWrite)) stampOwner(write as AnyWrite);
    if (!isMenuLayout(write as AnyWrite)) return;
    const next = v as MenuLayoutWrite | undefined;
    if (!next?.menuId) return;
    // The layout is whole each time, but prices are only the ones changed: the older ones' go with the newer, which wins.
    const older = mutationCache
      .findAll({ mutationKey: MENU_LAYOUT })
      .filter((old) => old !== write && isKeptWrite(old as AnyWrite) && (old.state.variables as MenuLayoutWrite | undefined)?.menuId === next.menuId)
      .sort((a, b) => a.state.submittedAt - b.state.submittedAt);
    if (!older.length) return;
    next.prices = Object.assign({}, ...older.map((old) => (old.state.variables as MenuLayoutWrite).prices), next.prices);
    for (const old of older) mutationCache.remove(old);
  },
  onSuccess: async (data, v, _ctx, write) => {
    refreshSpecBooksSoon();
    // A drink made offline from a menu section goes in it now, before the next waiting write runs (hooks/madeForSection.ts).
    const made = v as CreateDrinkInput | undefined;
    if (isNewDrink(write as AnyWrite) && (made?.queued || hasWaited(write as AnyWrite)) && made?.menuSectionId) {
      const result = data as CreateDrinkResult;
      const { placeInSection } = await loadMadeForSection();
      const warning = await placeInSection(queryClient, made.menuSectionId, { id: result.id, name: made.draft.name.trim() }).catch(() => 'It isn’t on the menu yet: add it from the menu.');
      if (warning) result.warnings.push(warning);
    }
    // Bar writes are kept until they're in (gcTime: Infinity below): once in, they go.
    if (isBarWrite(write as AnyWrite)) later(() => mutationCache.remove(write));
  },
  onError: (e, _v, _ctx, write) => {
    // Its reason is saved with it, so after a relaunch it still says why (an Error's message isn't in its JSON).
    if (e instanceof Error) Object.defineProperty(e, 'message', { value: e.message, enumerable: true, writable: true, configurable: true });
    // Out of tries on a dropped connection: kept like one that waited, never lost.
    if (isBarWrite(write as AnyWrite) && isNetworkError(e)) markWaited(write as AnyWrite);
    if (isBarWrite(write as AnyWrite) && !hasWaited(write as AnyWrite)) later(() => mutationCache.remove(write));
  },
});

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      // Run once even with no signal, so a query saved in a file reads it back
      // (queryFiles) behind the bar; the refresh then waits for signal.
      networkMode: 'offlineFirst',
      persister: queryFiles.persisterFn,
      // Never retry an answer (4xx, PostgREST codes such as PGRST116 "no rows");
      // retry overload (timeouts, 5xx, 544) once, with backoff and jitter, so a
      // struggling database isn't hit again at once (lib/queryRetry.ts).
      retry: retryQuery,
      retryDelay: (failures: number) => retryDelay(failures),
      // 5 minutes fresh, 30 in memory unused, and no refetch on returning to the
      // app; per-user and live data opt back in by tier (lib/queryDefaults.ts).
      ...BASE,
    },
    mutations: {
      // Writes aren't idempotent (a retried create can insert twice), so fail
      // fast and let the user retry. Offline writes still pause and resume.
      retry: 0,
      // Global error handler for all mutations using Burnt
      onError: (error) => {
        let message = 'An unexpected error occurred.';
        if (error instanceof Error) {
            message = error.message;
        }
        
        try {
          // lib/systemToast: burnt, which the web loads on the first toast.
          const { toast } = require('@/lib/systemToast');
          toast({
            title: 'Error',
            message: message,
            preset: 'error',
            duration: 3,
          });
        } catch (e) {
          // Fallback if burnt isn't installed natively (e.g., in Expo Go)
          const { Alert } = require('react-native');
          Alert.alert('Error', message);
          console.error('Mutation error:', error);
        }
      },
    }
  },
});

// The first screen's queries and unsent writes are one storage row, sized
// for Android by serializeCache. Each save serializes the whole row, so save
// at most every 5 seconds.
const rowStorage = guardStorage(AsyncStorage);
export const asyncStoragePersister = createCachePersister(rowStorage, 5000);

/**
 * What's saved to storage between launches: see lib/queryCachePersist.ts.
 * Before the first screen paints: the row, and the spec books, so Tonight
 * and a drink page open from the phone with no spinner and no signal.
 */
export const persistOptions = {
  persister: {
    ...asyncStoragePersister,
    restoreClient: async () => {
      // A row that can't be read, or a write in it that's broken, never stops the app opening (lib/queryCachePersist.ts).
      const canSend = (key: readonly unknown[]) => !!queryClient.getMutationDefaults(key as QueryKey).mutationFn;
      const [row] = await Promise.all([restoreRowSafely(rowStorage, asyncStoragePersister, canSend, reportError, SAVED.buster), loadSavedSpecBooks(queryClient).catch(() => undefined)]);
      // Old query files go once the first screens have settled.
      setTimeout(() => void pruneQueryFiles(savedQueryFiles, SAVED).catch(() => undefined), 30_000);
      return row;
    },
  },
  ...SAVED,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery, shouldDehydrateMutation: canResendAfterRelaunch },
};

/**
 * Only unsent writes registered below are saved between launches: the screen's
 * mutationFn doesn't survive a relaunch, so any other write would come back
 * unable to send and fail with "No mutationFn found".
 */
export function canResendAfterRelaunch(write: Mutation<unknown, Error, unknown, unknown>): boolean {
  const key = write.options.mutationKey;
  return isStoredWrite(write) && !!key && !!queryClient.getMutationDefaults(key).mutationFn;
}

/**
 * Sends writes saved offline before the app closed as soon as the cache is
 * restored, rather than at the next reconnect or return to the app. Never
 * awaited: the first screen doesn't wait on a send (no signal, wifi with no
 * internet, or a write stuck behind another), and auth only settles once the
 * restore has ended (hooks/useUserCacheSync.ts).
 */
export function resumeSavedWrites(): void {
  const restored = queryClient.getMutationCache().getAll().filter((write) => write.state.status === 'pending');
  if (!restored.length) return;
  void (async () => {
    // Stamped with who made them: sent once who's signed in is known, anyone else's dropped.
    if (writeOwner() === undefined && restored.some((write) => ownerOf(write as AnyWrite) !== undefined)) await ownerKnown();
    await sendRestored(restored);
  })().catch(() => undefined);
}

async function sendRestored(restored: Mutation<unknown, Error, unknown, unknown>[]): Promise<void> {
  for (const write of restored) if (madeBySomeoneElse(write as AnyWrite)) dropOthersWrite(queryClient, write as AnyWrite, 'relaunch');
  // onlineManager says online until NetInfo's first event, which can land
  // after the restore: ask first, or a write sent with no signal fails and is lost.
  const { isConnected } = await NetInfo.fetch();
  onlineManager.setOnline(!!isConnected);
  const cache = queryClient.getMutationCache();
  // One killed while it was sending comes back neither paused nor running, and it's first in its line: it goes
  // again first (a drink resends what it froze, hooks/useCreateDrink.ts), and the ones paused behind it follow in order.
  for (const write of restored) if (cache.getAll().includes(write) && write.state.status === 'pending' && !write.state.isPaused) void write.continue().catch(() => undefined);
  void queryClient.resumePausedMutations();
}

// Freshness by kind of data (static, catalog, public, yours, live), and a
// week in memory for whatever is saved between launches. A hook's own options win.
for (const { queryKey, options } of queryDefaults(PERSISTED_KEYS, FILE_KEYS)) {
  queryClient.setQueryDefaults(queryKey, options);
}

// Writes that can resume after a relaunch. A restored write gets only these
// options, not the screen's onSettled, so it refreshes what it changed itself;
// a live write's own onSettled wins.
// ponytail: refreshes every query, fine for a rare restored write; give each its own keys if they become common.
const refreshAll = () => queryClient.invalidateQueries();
queryClient.setMutationDefaults(['updateCocktail'], { mutationFn: updateCocktailFn, onSettled: refreshAll });
queryClient.setMutationDefaults(['deleteCocktail'], { mutationFn: deleteCocktailFn, onSettled: refreshAll });

// Behind-the-bar writes (hooks/barWrites.ts): they wait for signal, try again
// on a dropped connection, and survive the app closing.
/**
 * A saved write goes only as the person who made it: one stamped with someone else is dropped, not sent
 * (the Supabase client sends as whoever is signed in at send time). Checked once auth has settled.
 */
/** Dropped by ownWrite: nothing to tell the person signed in now (it wasn't theirs). */
const notTheirs = (e: unknown) => (e as { code?: string } | null)?.code === 'not-theirs';
async function ownWrite(v: unknown): Promise<void> {
  const write = mutationCache.find({ predicate: (m) => m.state.variables === v }) as AnyWrite | undefined;
  if (!write || ownerOf(write) === undefined) return;
  await ownerKnown();
  if (!madeBySomeoneElse(write)) return;
  dropOthersWrite(queryClient, write, 'send');
  throw Object.assign(new Error('Made by someone else on this phone, so it wasn’t sent.'), { code: 'not-theirs' });
}

// Discarded (Tonight's Waiting to send): what it touches is fetched again, so the screen shows what's really there.
setDiscardRefetch((client, write) => {
  // A batch set aside at launch: discarded, it leaves the phone.
  if (write.options.mutationKey?.[1] === SET_ASIDE_WRITE[1]) return void dropSetAside(rowStorage, (write.state.variables as { at: number }).at);
  const entry = Object.values(BAR_WRITES).find((w) => w.key[1] === write.options.mutationKey?.[1]);
  if (!entry) return;
  for (const queryKey of (entry.refresh as (v: unknown) => QueryKey[])(write.state.variables)) void client.invalidateQueries({ queryKey });
});

for (const write of Object.values(BAR_WRITES)) {
  // What a write does once it's in, or refused (a bottle's label photo, its toast): from its variables, so a restored one does it too.
  const after = write as { saved?: (qc: QueryClient, data: unknown, v: unknown) => Promise<void>; failed?: (e: Error, v: unknown) => Promise<void>; scope?: { id: string } };
  queryClient.setMutationDefaults(write.key, {
    mutationFn: (v: unknown) => ownWrite(v).then(() => (write.send as (v: unknown) => Promise<unknown>)(v)),
    retry: retryWrite,
    // Kept until it's in, even refused (mutationCache above).
    gcTime: Infinity,
    scope: after.scope,
    onSuccess: after.saved && ((data, v) => after.saved!(queryClient, data, v)),
    onError: after.failed && ((e, v) => void (notTheirs(e) ? undefined : after.failed!(e as Error, v).catch(() => undefined))),
    onSettled: (_data, _error, v) => {
      for (const queryKey of (write.refresh as (v: unknown) => QueryKey[])(v)) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

// Writes set aside at launch (lib/queryCachePersist.ts restoreRowSafely): listed as didn't send, never sent.
queryClient.setMutationDefaults([...SET_ASIDE_WRITE], {
  mutationFn: () => Promise.reject(new Error('It couldn’t be read back, so it can’t be sent.')),
  retry: false,
  gcTime: Infinity,
});

// A new drink (hooks/useCreateDrink.ts): its save is loaded when it sends, not in every page's first load.
const drinkSave = loadDrinkSave;
queryClient.setMutationDefaults(NEW_DRINK, {
  mutationFn: (v: unknown) => ownWrite(v).then(() => drinkSave()).then((m) => m.createDrink(v as CreateDrinkInput, queryClient)),
  retry: retryWrite,
  gcTime: Infinity,
  scope: OFFLINE_SCOPE,
  onSuccess: (r: unknown, v: unknown) => drinkSave().then((m) => m.newDrinkSaved(queryClient, r as CreateDrinkResult, v as CreateDrinkInput)),
  onError: (e: Error, v: unknown) => void (notTheirs(e) ? undefined : drinkSave().then((m) => m.newDrinkFailed(e, v as CreateDrinkInput), () => undefined)),
});

// The row saves every 5 seconds at most; a write that starts waiting for
// signal, or is refused after waiting, is saved at once, so closing the app straight after can't lose it.
let saving: ReturnType<typeof setTimeout> | undefined;
queryClient.getMutationCache().subscribe((event) => {
  const write = event.mutation as AnyWrite;
  // One that waited and is now in (or discarded) goes from the saved row at once too, so a quick relaunch can't send it again.
  if (event.type === 'removed' && hasWaited(write)) return saveSoon();
  if (event.type !== 'added' && event.type !== 'updated') return;
  // One restored from a relaunch (waiting or refused) or one waiting now: a refusal keeps it.
  if (write.state.isPaused || (event.type === 'added' && (write.state.status === 'error' || write.state.status === 'pending'))) markWaited(write);
  if (isStoredWrite(write)) saveSoon();
});
function saveSoon() {
  if (saving) return;
  saving = setTimeout(() => {
    saving = undefined;
    void saveWrites();
  }, 0);
}
const saveWrites = () => {
  const clientState = dehydrate(queryClient, persistOptions.dehydrateOptions);
  return asyncStoragePersister.saveNow({ timestamp: Date.now(), buster: SAVED.buster, clientState }).catch(() => undefined);
};
setWritesSaver(async (v) => {
  const write = mutationCache.find({ predicate: (m) => m.state.variables === v });
  if (write && isStoredWrite(write as AnyWrite)) await saveWrites();
});
