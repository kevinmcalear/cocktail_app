import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface KitState {
  /** Equipment ids (lib/techniques/equipment.ts) you have. */
  owned: string[];
  toggle: (id: string) => void;
}

/**
 * The equipment you have, so the technique library can say what you can make.
 * ponytail: per device, not synced or shared with a venue's team. Upgrade
 * path: a per-person (or per-venue) table when bars want one kit list.
 */
export const useKitStore = create<KitState>()(
  persist(
    (set) => ({
      owned: [],
      toggle: (id) => set((s) => ({ owned: s.owned.includes(id) ? s.owned.filter((o) => o !== id) : [...s.owned, id] })),
    }),
    { name: 'kit', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** The kit as a set, for canMake and friends. */
export function useKit(): ReadonlySet<string> {
  const owned = useKitStore((s) => s.owned);
  return new Set(owned);
}
