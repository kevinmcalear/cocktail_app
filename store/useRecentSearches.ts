import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { rememberSearch } from '@/lib/searchScope';

type RecentSearches = {
  /** What you searched, newest first (search2, Recent). */
  terms: string[];
  add: (term: string) => void;
  clear: () => void;
};

/** The words you searched, on this phone. What you opened is useRecentActivityStore's. */
export const useRecentSearches = create<RecentSearches>()(
  persist(
    (set) => ({
      terms: [],
      add: (term) => set((state) => ({ terms: rememberSearch(state.terms, term) })),
      clear: () => set({ terms: [] }),
    }),
    { name: 'recent-searches', storage: createJSONStorage(() => AsyncStorage) }
  )
);
