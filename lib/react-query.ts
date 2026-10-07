import { deleteCocktailFn, updateCocktailFn } from '@/hooks/useCocktails';
import { addIngredientFn, updateIngredientFn } from '@/hooks/useIngredients';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';

import { guardStorage, serializeCache, shouldPersistQuery } from '@/lib/queryCachePersist';

// Setup network listener for TanStack Query
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // "No rows" (PostgREST's PGRST116 from .single()) is an answer, not a
      // glitch: a drink that's private, hidden or gone won't appear on a
      // retry, and retrying only keeps a blank page up before the not
      // available one.
      retry: (failures, error) => (error as { code?: string } | null)?.code !== 'PGRST116' && failures < 2,
      refetchOnWindowFocus: true,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
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

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: guardStorage(AsyncStorage),
  // The cache is one storage row; Android can't read one over about 2 MB back.
  serialize: serializeCache,
  // Throttling saves performance by not writing to local storage too frequently
  throttleTime: 1000,
});

/** What's saved to storage between launches: see lib/queryCachePersist.ts. */
export const persistOptions = {
  persister: asyncStoragePersister,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
};

// Register mutation defaults so they can resume offline
queryClient.setMutationDefaults(['updateCocktail'], { mutationFn: updateCocktailFn });
queryClient.setMutationDefaults(['deleteCocktail'], { mutationFn: deleteCocktailFn });
queryClient.setMutationDefaults(['updateIngredient'], { mutationFn: updateIngredientFn });
queryClient.setMutationDefaults(['addIngredient'], { mutationFn: addIngredientFn });
