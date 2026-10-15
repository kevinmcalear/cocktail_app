import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface FirstOpenState {
  /** People on this device who have answered, or skipped, Discover's first-open question. */
  asked: string[];
  markAsked: (userId: string) => void;
}

/**
 * Discover's "Any favourites near you?" asks once per person on a device
 * (disc-first-open). AsyncStorage is localStorage on web; if storage is
 * blocked it asks again next time, which is harmless.
 * ponytail: per device, not per account. A second phone asks once more
 * unless the person already loved or hid a bar; move it to the profile if
 * that ever annoys anyone.
 */
export const useFirstOpen = create<FirstOpenState>()(
  persist((set) => ({ asked: [], markAsked: (userId) => set((s) => (s.asked.includes(userId) ? s : { asked: [...s.asked, userId] })) }), {
    name: 'discover-first-open',
    storage: createJSONStorage(() => AsyncStorage),
  })
);
