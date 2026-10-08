import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface Place {
  latitude: number;
  longitude: number;
}

interface LastPlaceState {
  /** Where near me last found this device, snapped to about 1 km (lib/nearMe.ts nearMeArea); null until it has. */
  place: Place | null;
  setPlace: (place: Place) => void;
  clear: () => void;
}

/**
 * The last near-me place, kept on this device only, so Discover opens on it
 * at once instead of waiting for a fresh position. Cleared on sign-out
 * (lib/clearUserData.ts): bar iPads are shared.
 */
export const useLastPlace = create<LastPlaceState>()(
  persist((set) => ({ place: null, setPlace: (place) => set({ place }), clear: () => set({ place: null }) }), {
    name: 'last-place',
    storage: createJSONStorage(() => AsyncStorage),
  })
);
