import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { dayKey, type CardProgress, type Rating } from '@/lib/study';

interface StudyProgressState {
  /** Per drink id. */
  cards: Record<string, CardProgress>;
  /** Days with at least one card rated (YYYY-MM-DD), newest last; capped. */
  days: string[];
  rate: (drinkId: string, rating: Rating) => void;
}

const MAX_DAYS = 400;

/**
 * Study progress on this device. ponytail: per device, not synced; a table
 * per person comes with the study rebuild's next step if staff want it across
 * devices.
 */
export const useStudyProgress = create<StudyProgressState>()(
  persist(
    (set) => ({
      cards: {},
      days: [],
      rate: (drinkId, rating) =>
        set((s) => {
          const now = new Date();
          const today = dayKey(now);
          const days = s.days.at(-1) === today ? s.days : [...s.days, today].slice(-MAX_DAYS);
          return { cards: { ...s.cards, [drinkId]: { rating, seenAt: now.toISOString() } }, days };
        }),
    }),
    { name: 'study-progress', storage: createJSONStorage(() => AsyncStorage) }
  )
);
