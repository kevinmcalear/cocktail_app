import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { EMPTY_DRAFT, newDraftId, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';

interface Kept {
  draft: WizardDraft;
  step: WizardStep;
  updatedAt: number;
}

interface DrinkWizardState {
  /** One unsaved drink per place it's being added: a venue's id, or 'home'. */
  kept: Record<string, Kept>;
  patch: (place: string, change: Partial<WizardDraft>) => void;
  setStep: (place: string, step: WizardStep) => void;
  clear: (place: string) => void;
}

const current = (s: DrinkWizardState, place: string): Kept => s.kept[place] ?? { draft: EMPTY_DRAFT, step: 'name', updatedAt: 0 };

/**
 * The drink being added, kept on the device on every change: it survives the
 * app going to the background (or being closed) and is only cleared once the
 * drink is saved, or someone starts over.
 */
export const useDrinkWizardStore = create<DrinkWizardState>()(
  persist(
    (set) => ({
      kept: {},
      patch: (place, change) =>
        set((s) => {
          const k = current(s, place);
          // The first change gives the draft its id (the drink's id once saved, and its drawing's seed).
          const draft = { ...k.draft, ...change, id: k.draft.id ?? newDraftId() };
          return { kept: { ...s.kept, [place]: { ...k, draft, updatedAt: Date.now() } } };
        }),
      setStep: (place, step) => set((s) => ({ kept: { ...s.kept, [place]: { ...current(s, place), step } } })),
      clear: (place) =>
        set((s) => {
          const { [place]: _gone, ...rest } = s.kept;
          return { kept: rest };
        }),
    }),
    { name: 'drink-wizard', storage: createJSONStorage(() => AsyncStorage), version: 1 }
  )
);

export const wizardPlace = (barId: string | null | undefined) => barId || 'home';
