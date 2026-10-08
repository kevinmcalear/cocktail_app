import { create } from 'zustand';

type Handoff = { sectionId: string; drinkId: string };

/**
 * A drink made with "Create a new drink" in a menu section, handed back to the
 * menu editor underneath it (useLayoutEditor), which puts it in that section.
 */
export const useMenuDrinkHandoff = create<{
  pending: Handoff | null;
  deliver: (sectionId: string, drinkId: string) => void;
  consume: () => Handoff | null;
}>((set, get) => ({
  pending: null,
  deliver: (sectionId, drinkId) => set({ pending: { sectionId, drinkId } }),
  consume: () => {
    const pending = get().pending;
    if (pending) set({ pending: null });
    return pending;
  },
}));
