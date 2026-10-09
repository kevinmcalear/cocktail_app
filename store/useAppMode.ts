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
  /** The venue last picked; kept while at home, so going back lands there. */
  venueId: string | null;
  setMode: (mode: AppMode) => void;
  setKnown: (mode: AppMode) => void;
  /** Work at this venue: venue mode, scoped to it. */
  enterVenue: (venueId: string) => void;
  /** Signed out: the next person on this device starts fresh. */
  forgetVenue: () => void;
}

/** Venue or home mode, and which venue, like switching accounts. Read it through useMode() and useActiveVenue(). */
export const useAppMode = create<AppModeState>()(
  persist(
    (set) => ({
      mode: null,
      known: null,
      venueId: null,
      setMode: (mode) => set({ mode, known: mode }),
      setKnown: (known) => set({ known }),
      enterVenue: (venueId) => set({ venueId, mode: 'venue', known: 'venue' }),
      forgetVenue: () => set({ venueId: null, mode: null }),
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
