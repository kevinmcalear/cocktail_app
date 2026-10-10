import { create } from 'zustand';

/**
 * Whether the magic eight ball is open. A hidden Easter egg: phones open it
 * with a shake, wide web with ⌘8 or "Pick for me" in the ⌘K search. Shown by
 * EightBallHost in the root layout.
 */
export const useEightBallStore = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
