import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CardProgress, Rating } from '@/lib/study';

interface StudyProgressState {
  /** Per drink id. */
  cards: Record<string, CardProgress>;
  rate: (drinkId: string, rating: Rating) => void;
}

/**
 * Study progress on this device. ponytail: per device, not synced; a table
 * per person comes with the study rebuild's next step if staff want it across
 * devices.
 *
 * Version 1 dropped the days studied: they only fed the day streak, and
 * Study keeps no streaks (decision no-streaks).
 */
export const useStudyProgress = create<StudyProgressState>()(
  persist(
    (set) => ({
      cards: {},
      rate: (drinkId, rating) => set((s) => ({ cards: { ...s.cards, [drinkId]: { rating, seenAt: new Date().toISOString() } } })),
    }),
    {
      name: 'study-progress',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (saved) => ({ cards: (saved as { cards?: Record<string, CardProgress> } | null)?.cards ?? {} }) as StudyProgressState,
    }
  )
);
