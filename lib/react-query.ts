import { deleteCocktailFn, updateCocktailFn } from '@/hooks/useCocktails';
import { addIngredientFn, updateIngredientFn } from '@/hooks/useIngredients';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { createCachePersister, guardStorage, PERSISTED_KEYS, shouldPersistQuery } from '@/lib/queryCachePersist';
import { BASE, KEEP, queryDefaults } from '@/lib/queryDefaults';

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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // "No rows" (PostgREST's PGRST116 from .single()) is an answer, not a
      // glitch: a drink that's private, hidden or gone won't appear on a
      // retry, and retrying only keeps a blank page up before the not
      // available one.
      retry: (failures, error) => (error as { code?: string } | null)?.code !== 'PGRST116' && failures < 2,
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
          const burnt = require('burnt');
          burnt.toast({
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

// The cache is one storage row, sized for Android by serializeCache. Each
// save serializes the whole cache, so save at most every 5 seconds.
export const asyncStoragePersister = createCachePersister(guardStorage(AsyncStorage), 5000);

/** What's saved to storage between launches: see lib/queryCachePersist.ts. */
export const persistOptions = {
  persister: asyncStoragePersister,
  // A week, not the 24 h default: opening the app after a weekend paints the
  // last results at once and refreshes behind them. A new app version starts
  // clean, since its query shapes may differ (an OTA bumps a key instead).
  maxAge: KEEP,
  buster: Constants.expoConfig?.version ?? '',
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
};

// Freshness by kind of data (static, catalog, public, yours, live), and a
// week in memory for whatever is saved between launches. A hook's own options win.
for (const { queryKey, options } of queryDefaults(PERSISTED_KEYS)) {
  queryClient.setQueryDefaults(queryKey, options);
}

// Register mutation defaults so they can resume offline
queryClient.setMutationDefaults(['updateCocktail'], { mutationFn: updateCocktailFn });
queryClient.setMutationDefaults(['deleteCocktail'], { mutationFn: deleteCocktailFn });
queryClient.setMutationDefaults(['updateIngredient'], { mutationFn: updateIngredientFn });
queryClient.setMutationDefaults(['addIngredient'], { mutationFn: addIngredientFn });
