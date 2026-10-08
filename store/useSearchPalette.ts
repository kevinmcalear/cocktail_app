import { create } from 'zustand';

/** Wide web's ⌘K search, opened from the sidebar or the keyboard over whatever page is showing. */
export const useSearchPalette = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
