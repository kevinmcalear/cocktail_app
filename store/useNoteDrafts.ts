import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface NoteDraft {
  body: string;
  /** Report a problem's kind ("broken"), once picked. */
  kind?: string | null;
  /** When it was last typed in (ms), so drafts nobody came back to are dropped. */
  at?: number;
}

/** A draft nobody has touched in this long is dropped the next time any is saved. */
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

interface NoteDraftsState {
  /** By person, screen, bar and drink draft ("<user id>:Adding a drink › Ice:<bar id>:<draft id>"). */
  drafts: Record<string, NoteDraft>;
  save: (key: string, draft: NoteDraft | null) => void;
}

/**
 * What someone has typed into a Tell us or Report a problem sheet, kept on
 * the device until it's sent, so a send that fails offline (or a closed
 * sheet, or a closed app) never loses the words. Keyed by person, so the next
 * person to sign in on a shared device doesn't see them. A picked photo isn't
 * kept: on the web its address only lasts as long as the page.
 */
export const useNoteDrafts = create<NoteDraftsState>()(
  persist(
    (set) => ({
      drafts: {},
      save: (key, draft) =>
        set((s) => {
          const now = Date.now();
          // Drafts for drinks long since saved or given up (a draft id that never comes back) go.
          const drafts = Object.fromEntries(Object.entries(s.drafts).filter(([, d]) => now - (d.at ?? 0) < KEEP_MS));
          if (draft) drafts[key] = { ...draft, at: now };
          else delete drafts[key];
          return { drafts };
        }),
    }),
    { name: 'note-drafts', storage: createJSONStorage(() => AsyncStorage) }
  )
);
