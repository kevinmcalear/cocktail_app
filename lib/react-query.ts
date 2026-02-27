import { deleteCocktailFn, updateCocktailFn } from '@/hooks/useCocktails';
import { addIngredientFn, updateIngredientFn } from '@/hooks/useIngredients';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';

// Setup network listener for TanStack Query
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
    mutations: {
      retry: 3,
      // Global error handler for all mutations using Burnt
      onError: (error) => {
        const burnt = require('burnt');
        let message = 'An unexpected error occurred.';
        if (error instanceof Error) {
            message = error.message;
        }
        burnt.toast({
          title: 'Error',
          message: message,
          preset: 'error',
          duration: 3,
        });
      },
    }
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  // Throttling saves performance by not writing to local storage too frequently
  throttleTime: 1000,
});

// Register mutation defaults so they can resume offline
queryClient.setMutationDefaults(['updateCocktail'], { mutationFn: updateCocktailFn });
queryClient.setMutationDefaults(['deleteCocktail'], { mutationFn: deleteCocktailFn });
queryClient.setMutationDefaults(['updateIngredient'], { mutationFn: updateIngredientFn });
queryClient.setMutationDefaults(['addIngredient'], { mutationFn: addIngredientFn });
