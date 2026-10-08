import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface Kept<D, S extends string> {
  draft: D;
  step: S;
  updatedAt: number;
}

export interface WizardState<D, S extends string> {
  /** One unsaved draft per place it's being added: a venue's id, or 'home'. */
  kept: Record<string, Kept<D, S>>;
  patch: (place: string, change: Partial<D>) => void;
  setStep: (place: string, step: S) => void;
  clear: (place: string) => void;
}

/**
 * An add wizard's draft, kept on the device on every change: it survives the
 * app going to the background (or being closed) and is only cleared once
 * it's saved, or someone starts over. The draft must be plain JSON.
 */
export function createWizardStore<D extends object, S extends string>(name: string, empty: D, firstStep: S) {
  const current = (s: WizardState<D, S>, place: string): Kept<D, S> => s.kept[place] ?? { draft: empty, step: firstStep, updatedAt: 0 };
  return create<WizardState<D, S>>()(
    persist(
      (set) => ({
        kept: {},
        patch: (place, change) =>
          set((s) => {
            const k = current(s, place);
            return { kept: { ...s.kept, [place]: { ...k, draft: { ...k.draft, ...change }, updatedAt: Date.now() } } };
          }),
        setStep: (place, step) => set((s) => ({ kept: { ...s.kept, [place]: { ...current(s, place), step } } })),
        clear: (place) =>
          set((s) => {
            const { [place]: _gone, ...rest } = s.kept;
            return { kept: rest };
          }),
      }),
      { name, storage: createJSONStorage(() => AsyncStorage), version: 1 }
    )
  );
}

export const wizardPlace = (barId: string | null | undefined) => barId || 'home';
