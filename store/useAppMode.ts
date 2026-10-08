import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppMode = 'venue' | 'home';

interface AppModeState {
  /** The mode last picked in the venue chip; null until someone picks. */
  mode: AppMode | null;
  /** The mode the app last settled on, for the next launch's first frame. */
  known: AppMode | null;
  setMode: (mode: AppMode) => void;
  setKnown: (mode: AppMode) => void;
}

/** Venue or home mode, like switching accounts. Read it through useMode(). */
export const useAppMode = create<AppModeState>()(
  persist(
    (set) => ({
      mode: null,
      known: null,
      setMode: (mode) => set({ mode, known: mode }),
      setKnown: (known) => set({ known }),
    }),
    { name: 'app-mode', storage: createJSONStorage(() => AsyncStorage) }
  )
);

const onHydrated = (listener: () => void) => useAppMode.persist.onFinishHydration(listener);
const isHydrated = () => useAppMode.persist.hasHydrated();

/** Whether the saved mode has been read back from storage yet (never during a static render). */
export function useAppModeHydrated(): boolean {
  return useSyncExternalStore(onHydrated, isHydrated, () => false);
}
