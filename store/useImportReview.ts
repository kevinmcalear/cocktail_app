import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { startChoices, type RecipeChoices } from '@/lib/bringInDraft';
import { addMade, nothingMade, type DrinkMark, type MadeSoFar } from '@/lib/importReview';
import type { ReadFile } from '@/lib/readAnything';
import type { RecipeReading } from '@/supabase/functions/_shared/anythingRead';

/** A big import (more than one recipe) being checked drink by drink. Plain JSON: it's kept on the device. */
export interface ImportReview {
  id: string;
  /** The venue it comes into; null for your home bar. */
  barId: string | null;
  /** "Little Rye spec book", or "12 recipes" when there's no file name. */
  title: string;
  /** The batch's source label ("From a PDF"), and the eyebrow's "From a PDF". */
  source: string;
  from: string;
  recipes: RecipeReading[];
  /** The pages it was read from. Their uris may be gone after a restart; the drinks are already read. */
  files: ReadFile[];
  choices: RecipeChoices[];
  marks: DrinkMark[];
  /** The drink on screen. */
  at: number;
  made: MadeSoFar;
  updatedAt: string;
}

export type NewReview = Pick<ImportReview, 'barId' | 'title' | 'source' | 'from' | 'recipes' | 'files'>;

interface ImportReviewState {
  reviews: Record<string, ImportReview>;
  /** Cards put off with Later, until the app next opens. Not kept. */
  later: string[];
  begin: (review: NewReview) => string;
  go: (id: string, at: number) => void;
  choose: (id: string, at: number, change: Partial<RecipeChoices>) => void;
  /** Marks a drink; an approved one brings what it made. */
  mark: (id: string, at: number, mark: DrinkMark, made?: MadeSoFar) => void;
  remove: (id: string) => void;
  putOff: (id: string) => void;
}

const now = () => new Date().toISOString();

/**
 * Big imports waiting to be finished, on this device (canvas eddie-oct22-wave2,
 * Fix 11): Finish later leaves the rest here and the Library shows a card to
 * carry on. Approved drinks are already saved. ponytail: kept on the device,
 * so a review started on the laptop can't be finished on the phone; a table
 * of waiting drinks is the upgrade (needs Kevin's OK for the migration).
 */
export const useImportReview = create<ImportReviewState>()(
  persist(
    (set) => {
      const edit = (id: string, change: (r: ImportReview) => Partial<ImportReview>) =>
        set((s) => (s.reviews[id] ? { reviews: { ...s.reviews, [id]: { ...s.reviews[id], ...change(s.reviews[id]), updatedAt: now() } } } : s));
      return {
        reviews: {},
        later: [],
        begin: (review) => {
          const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          const fresh: ImportReview = { ...review, id, choices: review.recipes.map(startChoices), marks: review.recipes.map(() => 'waiting'), at: 0, made: nothingMade(), updatedAt: now() };
          set((s) => ({ reviews: { ...s.reviews, [id]: fresh } }));
          return id;
        },
        go: (id, at) => edit(id, (r) => ({ at: Math.max(0, Math.min(at, r.recipes.length - 1)) })),
        choose: (id, at, change) => edit(id, (r) => ({ choices: r.choices.map((c, i) => (i === at ? { ...c, ...change } : c)) })),
        mark: (id, at, mark, made) => edit(id, (r) => ({ marks: r.marks.map((m, i) => (i === at ? mark : m)), made: made ? addMade(r.made, made) : r.made })),
        remove: (id) =>
          set((s) => {
            const { [id]: _gone, ...rest } = s.reviews;
            return { reviews: rest };
          }),
        putOff: (id) => set((s) => ({ later: [...s.later, id] })),
      };
    },
    { name: 'import-review', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ reviews: s.reviews }) }
  )
);

/** True once the kept reviews are read back (async on every platform). */
export function useReviewsLoaded(): boolean {
  return useSyncExternalStore(useImportReview.persist.onFinishHydration, useImportReview.persist.hasHydrated, () => false);
}

/** Reviews waiting here (a venue, or home), newest first, without the ones put off. */
export function useWaitingReviews(barId: string | null): ImportReview[] {
  const reviews = useImportReview((s) => s.reviews);
  const later = useImportReview((s) => s.later);
  return Object.values(reviews)
    .filter((r) => r.barId === barId && !later.includes(r.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
