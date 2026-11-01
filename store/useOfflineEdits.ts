import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Spec edits saved with no signal, kept on this phone as drafts until the
 * editor opens again with signal (hooks/useCocktailEditor.ts). `base` is the
 * spec the edit started from (lib/offlineEdits.ts specFingerprint), so the
 * editor can ask before laying it over a spec someone changed since.
 * Cleared on sign out: a shared bar iPad's next person must not send them.
 */
export interface OfflineEdit {
  /** When it was kept, in ms. */
  at: number;
  base: string;
  /** The editor's fields, as useCocktailEditor's specForm(). */
  form: unknown;
}

interface OfflineEdits {
  edits: Record<string, OfflineEdit>;
  keep: (itemId: string, edit: OfflineEdit) => void;
  forget: (itemId: string) => void;
}

export const useOfflineEdits = create<OfflineEdits>()(
  persist(
    (set) => ({
      edits: {},
      keep: (itemId, edit) => set((s) => ({ edits: { ...s.edits, [itemId]: edit } })),
      forget: (itemId) =>
        set((s) => {
          const { [itemId]: _gone, ...rest } = s.edits;
          return { edits: rest };
        }),
    }),
    { name: 'offline-spec-edits', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ edits: s.edits }) }
  )
);
