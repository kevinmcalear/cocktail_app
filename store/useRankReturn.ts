import { create } from 'zustand';

/**
 * Rank it's "Snap the menu" goes out to Bring in and comes back (Loop-rank,
 * Find the drink): what was typed, whether the menu was saved, and when the
 * person is back at the Rank it sheet. Not persisted: a quit app starts over.
 * `away`: Bring in is reading or checking; `saved`: Brought in is on screen;
 * `back`: Rank it opens again (home Tonight takes it).
 */
export interface RankReturn {
  phase: 'away' | 'saved' | 'back';
  /** The search that was typed, put back in the field. */
  query: string;
  /** The menu Bring in saved, whose drinks lead the list when back; null when nothing was saved. */
  menuId: string | null;
}

interface RankReturnState {
  ret: RankReturn | null;
  /** Snap started a bring-in from Rank it. */
  begin: (query: string) => void;
  /** Bring in saved something; Brought in offers the way back. */
  saved: (menuId: string | null) => void;
  /** Bring in ended with nothing saved (cancelled, closed, backed out of): back to ranking. No-op unless Rank it started this bring-in and it is still away. */
  back: () => void;
  /** Brought in's way back to ranking, from `saved`. */
  resume: () => void;
  /** Rank it took the return (opened again). */
  take: () => RankReturn | null;
  /** Gone for good (left Brought in another way). Only a return that is still `saved`, unless `any`. */
  drop: (any?: boolean) => void;
}

export const useRankReturn = create<RankReturnState>()((set, get) => ({
  ret: null,
  begin: (query) => set({ ret: { phase: 'away', query, menuId: null } }),
  saved: (menuId) => {
    const ret = get().ret;
    if (ret) set({ ret: { ...ret, phase: 'saved', menuId } });
  },
  back: () => {
    const ret = get().ret;
    if (ret?.phase === 'away') set({ ret: { ...ret, phase: 'back' } });
  },
  resume: () => {
    const ret = get().ret;
    if (ret?.phase === 'saved') set({ ret: { ...ret, phase: 'back' } });
  },
  take: () => {
    const ret = get().ret;
    if (ret?.phase !== 'back') return null;
    set({ ret: null });
    return ret;
  },
  drop: (any = false) => {
    if (any || get().ret?.phase === 'saved') set({ ret: null });
  },
}));
