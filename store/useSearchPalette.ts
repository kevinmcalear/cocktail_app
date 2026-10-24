import { create } from 'zustand';

import type { SearchScope } from '@/lib/searchScope';

/** What a door carries into the palette: the words and where they search ("Search everywhere for “neg”"). */
export interface SearchStart {
  query: string;
  scope: SearchScope | null;
}

const BLANK: SearchStart = { query: '', scope: null };

interface SearchPalette {
  open: boolean;
  /** Read once as the palette opens. */
  start: SearchStart;
  setOpen: (open: boolean) => void;
  /** Opens the palette on a search. */
  search: (start: SearchStart) => void;
}

/** Wide web's ⌘K search, opened from the sidebar or the keyboard over whatever page is showing. */
export const useSearchPalette = create<SearchPalette>()((set) => ({
  open: false,
  start: BLANK,
  setOpen: (open) => set({ open, start: BLANK }),
  search: (start) => set({ open: true, start }),
}));
