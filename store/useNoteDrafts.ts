import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface NoteDraft {
  body: string;
  /** Report a problem's kind ("broken"), once picked. */
  kind?: string | null;
}

interface NoteDraftsState {
  /** By person and screen ("<user id>:Adding a drink › Ice"). */
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
          const drafts = { ...s.drafts };
          if (draft) drafts[key] = draft;
          else delete drafts[key];
          return { drafts };
        }),
    }),
    { name: 'note-drafts', storage: createJSONStorage(() => AsyncStorage) }
  )
);
