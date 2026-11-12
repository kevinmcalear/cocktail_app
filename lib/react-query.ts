import { BAR_WRITES } from '@/hooks/barWrites';
import { deleteCocktailFn, updateCocktailFn } from '@/hooks/useCocktails';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { dehydrate, focusManager, type Mutation, MutationCache, type QueryKey, notifyManager, onlineManager, QueryCache, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { coalesceTimer } from '@/lib/coalesceTimer';
import { loadDrinkSave } from '@/lib/drinkSaveLoader';
import { hasWaited, isKeptWrite, markWaited, setQuerySaver, type AnyWrite } from '@/lib/keptWrites';
import { fileStore } from '@/lib/fileStore';
import {
  createCachePersister,
  createFilePersister,
  FILE_KEYS,
  guardStorage,
  PERSISTED_KEYS,
  pruneQueryFiles,
  shouldPersistQuery,
} from '@/lib/queryCachePersist';
import { BASE, KEEP, queryDefaults } from '@/lib/queryDefaults';
import { retryDelay, retryQuery } from '@/lib/queryRetry';
import { BAR_WRITE, NEW_DRINK, OFFLINE_SCOPE, retryBarWrite } from '@/lib/offlineWrites';
import type { CreateDrinkInput, CreateDrinkResult } from '@/hooks/useCreateDrink';
import { loadSavedSpecBooks } from '@/lib/specBookFile';

// Setup network listener for TanStack Query
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

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
const later = (fn: () => void) => setTimeout(fn, 0);

const mutationCache = new MutationCache({
  onSuccess: (_data, _v, _ctx, write) => {
    refreshSpecBooksSoon();
    // Bar writes are kept until they're in (gcTime: Infinity below): once in, they go.
    if (isBarWrite(write as AnyWrite)) later(() => mutationCache.remove(write));
  },
  onError: (_e, _v, _ctx, write) => {
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
export const asyncStoragePersister = createCachePersister(guardStorage(AsyncStorage), 5000);

/**
 * What's saved to storage between launches: see lib/queryCachePersist.ts.
 * Before the first screen paints: the row, and the spec books, so Tonight
 * and a drink page open from the phone with no spinner and no signal.
 */
export const persistOptions = {
  persister: {
    ...asyncStoragePersister,
    restoreClient: async () => {
      const [row] = await Promise.all([asyncStoragePersister.restoreClient(), loadSavedSpecBooks(queryClient).catch(() => undefined)]);
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
  return isKeptWrite(write) && !!key && !!queryClient.getMutationDefaults(key).mutationFn;
}

/**
 * Sends writes saved offline before the app closed as soon as the cache is
 * restored, rather than at the next reconnect or return to the app. Sign-out
 * already dropped any that weren't this user's (lib/clearUserData.ts).
 */
export async function resumeSavedWrites(): Promise<void> {
  if (!queryClient.getMutationCache().getAll().some((write) => write.state.isPaused)) return;
  // onlineManager says online until NetInfo's first event, which can land
  // after the restore: ask first, or a write sent with no signal fails and is lost.
  const { isConnected } = await NetInfo.fetch();
  onlineManager.setOnline(!!isConnected);
  await queryClient.resumePausedMutations();
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
for (const write of Object.values(BAR_WRITES)) {
  // What a write does once it's in, or refused (a bottle's label photo, its toast): from its variables, so a restored one does it too.
  const after = write as { saved?: (qc: QueryClient, data: unknown, v: unknown) => Promise<void>; failed?: (e: Error, v: unknown) => Promise<void>; scope?: { id: string } };
  queryClient.setMutationDefaults(write.key, {
    mutationFn: write.send as (v: unknown) => Promise<unknown>,
    retry: retryBarWrite,
    // Kept until it's in, even refused (mutationCache above).
    gcTime: Infinity,
    scope: after.scope,
    onSuccess: after.saved && ((data, v) => after.saved!(queryClient, data, v)),
    onError: after.failed && ((e, v) => void after.failed!(e as Error, v).catch(() => undefined)),
    onSettled: (_data, _error, v) => {
      for (const queryKey of (write.refresh as (v: unknown) => QueryKey[])(v)) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

// A new drink (hooks/useCreateDrink.ts): its save is loaded when it sends, not in every page's first load.
const drinkSave = loadDrinkSave;
queryClient.setMutationDefaults(NEW_DRINK, {
  mutationFn: (v: unknown) => drinkSave().then((m) => m.createDrink(v as CreateDrinkInput, queryClient)),
  retry: retryBarWrite,
  gcTime: Infinity,
  scope: OFFLINE_SCOPE,
  onSuccess: (r: unknown, v: unknown) => drinkSave().then((m) => m.newDrinkSaved(queryClient, r as CreateDrinkResult, v as CreateDrinkInput)),
  onError: (e: Error, v: unknown) => void drinkSave().then((m) => m.newDrinkFailed(e, v as CreateDrinkInput), () => undefined),
});

// The row saves every 5 seconds at most; a write that starts waiting for
// signal, or is refused after waiting, is saved at once, so closing the app straight after can't lose it.
let saving: ReturnType<typeof setTimeout> | undefined;
queryClient.getMutationCache().subscribe((event) => {
  if (event.type !== 'added' && event.type !== 'updated') return;
  const write = event.mutation as AnyWrite;
  // One restored from a relaunch (waiting or refused) or one waiting now: a refusal keeps it.
  if (write.state.isPaused || (event.type === 'added' && write.state.status === 'error')) markWaited(write);
  if (!isKeptWrite(write) || saving) return;
  saving = setTimeout(() => {
    saving = undefined;
    const clientState = dehydrate(queryClient, persistOptions.dehydrateOptions);
    void asyncStoragePersister.saveNow({ timestamp: Date.now(), buster: SAVED.buster, clientState }).catch(() => undefined);
  }, 0);
});
