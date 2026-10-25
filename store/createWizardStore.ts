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
  /**
   * With `tombstones` (the drink wizard): places cleared here (saved, or
   * started over), and how new the draft was, still to take out of the
   * account's copy (hooks/useDraftSync); kept until that's done, offline too.
   */
  cleared: { place: string; at: number }[];
  /** Taken out of the account: off the cleared list. */
  forgot: (places: string[]) => void;
}

/**
 * An add wizard's draft, kept on the device on every change: it survives the
 * app going to the background (or being closed) and is only cleared once
 * it's saved, or someone starts over. The draft must be plain JSON.
 */
export function createWizardStore<D extends object, S extends string>(
  name: string,
  empty: D,
  firstStep: S,
  /** Runs on every change: stamps what a draft must carry (the drink wizard's id). */
  prepare: (draft: D) => D = (d) => d,
  { tombstones = false }: { tombstones?: boolean } = {}
) {
  const current = (s: WizardState<D, S>, place: string): Kept<D, S> => s.kept[place] ?? { draft: empty, step: firstStep, updatedAt: 0 };
  return create<WizardState<D, S>>()(
    persist(
      (set) => ({
        kept: {},
        cleared: [],
        forgot: (places) => set((s) => ({ cleared: s.cleared.filter((c) => !places.includes(c.place)) })),
        patch: (place, change) =>
          set((s) => {
            const k = current(s, place);
            return { kept: { ...s.kept, [place]: { ...k, draft: prepare({ ...k.draft, ...change }), updatedAt: Date.now() } } };
          }),
        setStep: (place, step) => set((s) => ({ kept: { ...s.kept, [place]: { ...current(s, place), step, updatedAt: Date.now() } } })),
        clear: (place) =>
          set((s) => {
            const { [place]: gone, ...rest } = s.kept;
            if (!tombstones || !gone) return { kept: rest };
            return { kept: rest, cleared: [...s.cleared.filter((c) => c.place !== place), { place, at: gone.updatedAt }] };
          }),
      }),
      { name, storage: createJSONStorage(() => AsyncStorage), version: 1 }
    )
  );
}

export const wizardPlace = (barId: string | null | undefined) => barId || 'home';
