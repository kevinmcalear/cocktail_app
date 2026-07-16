import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RecentKind = 'cocktail' | 'beer' | 'wine' | 'ingredient' | 'menu' | 'quiz';

export type RecentActivity = {
  id: string;
  kind: RecentKind;
  title: string;
  subtitle?: string;
  href: string;
  imageUrl?: string | null;
  /** Venue bar_id; null = personal. Undefined = legacy (pre-venue) entry. */
  barId?: string | null;
  isDraft?: boolean;
  at: number;
};

type RecentState = {
  items: RecentActivity[];
  push: (entry: Omit<RecentActivity, 'at'>) => void;
};

const MAX = 8; // ponytail: enough for palette RECENT; was 3 for continue cards

export const useRecentActivityStore = create<RecentState>()(
  persist(
    (set) => ({
      items: [],
      // ponytail: last-N ring buffer; upgrade to server sync if multi-device matters
      push: (entry) =>
        set((state) => {
          const next = [
            { ...entry, at: Date.now() },
            ...state.items.filter((i) => !(i.kind === entry.kind && i.id === entry.id)),
          ].slice(0, MAX);
          return { items: next };
        }),
    }),
    {
      name: 'recent-activity',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
