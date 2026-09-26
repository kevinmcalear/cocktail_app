import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppMode = 'venue' | 'home';

interface AppModeState {
  /** The mode last picked in the venue chip; null until someone picks. */
  mode: AppMode | null;
  setMode: (mode: AppMode) => void;
}

/** Venue or home mode, like switching accounts. Read it through useMode(). */
export const useAppMode = create<AppModeState>()(
  persist((set) => ({ mode: null, setMode: (mode) => set({ mode }) }), {
    name: 'app-mode',
    storage: createJSONStorage(() => AsyncStorage),
  })
);
