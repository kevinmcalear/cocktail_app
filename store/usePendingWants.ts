import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface PendingWantsState {
  /** Drinks wanted in first run's swipes, waiting for the age check. */
  ids: string[];
  hold: (ids: readonly string[]) => void;
  clear: () => void;
}

/**
 * First run's Wants made before the age check, kept on this device (review
 * 12 Nov: they lived in the screen and were lost). Saved when the age is
 * confirmed, dropped when it isn't (hooks/useAgeCheck useConfirmAge) or on
 * sign-out (lib/clearUserData.ts). Nothing says they're saved until then.
 */
export const usePendingWants = create<PendingWantsState>()(
  persist((set) => ({ ids: [], hold: (ids) => set((s) => ({ ids: [...new Set([...s.ids, ...ids])] })), clear: () => set({ ids: [] }) }), {
    name: 'pending-wants',
    storage: createJSONStorage(() => AsyncStorage),
  })
);
