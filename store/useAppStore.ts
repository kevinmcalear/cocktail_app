import { PERSONAL_CONTEXT } from '@/lib/barContextFilter';
import { create } from 'zustand';

function syncSelectedBarId(contextIds: string[]): string | null {
    return contextIds.find((id) => id !== PERSONAL_CONTEXT) ?? null;
}

interface AppState {
    draftCocktailId: string | null;
    setDraftCocktailId: (id: string | null) => void;

    // Bar Management Context — multi-select: 'personal' | bar uuid
    selectedContextIds: string[];
    setSelectedContextIds: (ids: string[]) => void;
    toggleContextId: (id: string) => void;
    /** First selected venue (not personal); used for role checks. */
    selectedBarId: string | null;
    setSelectedBarId: (id: string | null) => void;
    selectedMenuId: string | null;
    setSelectedMenuId: (id: string | null) => void;
    recentlyCreatedItem: { type: 'cocktail' | 'ingredient'; id: string; name: string } | null;
    setRecentlyCreatedItem: (
        item: { type: 'cocktail' | 'ingredient'; id: string; name: string } | null
    ) => void;
}

export const useAppStore = create<AppState>((set) => ({
    draftCocktailId: null,
    setDraftCocktailId: (id) => set({ draftCocktailId: id }),
    // ponytail: default personal-only (matches old selectedBarId: null)
    selectedContextIds: [PERSONAL_CONTEXT],
    setSelectedContextIds: (ids) =>
        set({
            selectedContextIds: ids.length ? ids : [PERSONAL_CONTEXT],
            selectedBarId: syncSelectedBarId(ids.length ? ids : [PERSONAL_CONTEXT]),
        }),
    toggleContextId: (id) =>
        set((state) => {
            const has = state.selectedContextIds.includes(id);
            let next = has
                ? state.selectedContextIds.filter((x) => x !== id)
                : [...state.selectedContextIds, id];
            if (next.length === 0) next = [PERSONAL_CONTEXT];
            return { selectedContextIds: next, selectedBarId: syncSelectedBarId(next) };
        }),
    selectedBarId: null,
    // keep single-select API for editors; mirrors into multi-select
    setSelectedBarId: (id) =>
        set({
            selectedBarId: id,
            selectedContextIds: id ? [id] : [PERSONAL_CONTEXT],
        }),
    selectedMenuId: null,
    setSelectedMenuId: (id) => set({ selectedMenuId: id }),
    recentlyCreatedItem: null,
    setRecentlyCreatedItem: (item) => set({ recentlyCreatedItem: item }),
}));
