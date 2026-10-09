import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface KitState {
  /** Equipment ids (lib/techniques/equipment.ts) you have. */
  owned: string[];
  toggle: (id: string) => void;
  clear: () => void;
}

/**
 * The equipment ticked on this device while signed out (or before the
 * account had a kit list). Read it through hooks/useKit.ts, which moves it
 * up to the account on sign-in and clears it here.
 */
export const useKitStore = create<KitState>()(
  persist(
    (set) => ({
      owned: [],
      toggle: (id) => set((s) => ({ owned: s.owned.includes(id) ? s.owned.filter((o) => o !== id) : [...s.owned, id] })),
      clear: () => set({ owned: [] }),
    }),
    { name: 'kit', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
