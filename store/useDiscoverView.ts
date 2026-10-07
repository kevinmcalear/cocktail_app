import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type DiscoverView = 'list' | 'map';

interface DiscoverViewState {
  /** The list or map, as last picked on this device; null until someone picks. */
  view: DiscoverView | null;
  setView: (view: DiscoverView) => void;
}

/**
 * Discover's list or map on phones, remembered per device. AsyncStorage is
 * localStorage on web; if storage is blocked the store just starts empty.
 */
export const useDiscoverView = create<DiscoverViewState>()(
  persist((set) => ({ view: null, setView: (view) => set({ view }) }), {
    name: 'discover-view',
    storage: createJSONStorage(() => AsyncStorage),
  })
);
