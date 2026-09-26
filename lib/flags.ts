import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * The redesign ships screen by screen behind one flag, so staff keep the
 * current app until each new screen is finished. The first answer wins:
 *   1. the person's own choice (a preview toggle, for admins and testers),
 *   2. PostHog's `redesign` feature flag (bridged in components/Analytics),
 *   3. EXPO_PUBLIC_REDESIGN=1, for local and preview builds.
 */
interface FlagState {
  /** Persisted. null = no personal choice. */
  redesignOverride: boolean | null;
  /** From PostHog. null = PostHog is off or hasn't answered. */
  redesignRemote: boolean | null;
  setRedesignOverride: (value: boolean | null) => void;
  setRedesignRemote: (value: boolean | null) => void;
}

export const useFlagStore = create<FlagState>()(
  persist(
    (set) => ({
      redesignOverride: null,
      redesignRemote: null,
      setRedesignOverride: (value) => set({ redesignOverride: value }),
      setRedesignRemote: (value) => set({ redesignRemote: value }),
    }),
    {
      name: 'flags-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ redesignOverride: state.redesignOverride }),
    }
  )
);

const REDESIGN_DEFAULT = process.env.EXPO_PUBLIC_REDESIGN === '1';

/** True when this person should see redesigned screens. */
export function useRedesign(): boolean {
  return useFlagStore((s) => s.redesignOverride ?? s.redesignRemote ?? REDESIGN_DEFAULT);
}
