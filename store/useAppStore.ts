import { create } from 'zustand';

interface AppState {
    draftCocktailId: string | null;
    setDraftCocktailId: (id: string | null) => void;

    recentlyCreatedItem: {
        type: 'cocktail' | 'ingredient';
        id: string;
        name: string;
        replacedId?: string | null;
        targetId?: string | null;
    } | null;
    setRecentlyCreatedItem: (
        item: {
            type: 'cocktail' | 'ingredient';
            id: string;
            name: string;
            replacedId?: string | null;
            targetId?: string | null;
        } | null
    ) => void;
}

export const useAppStore = create<AppState>((set) => ({
    draftCocktailId: null,
    setDraftCocktailId: (id) => set({ draftCocktailId: id }),
    recentlyCreatedItem: null,
    setRecentlyCreatedItem: (item) => set({ recentlyCreatedItem: item }),
}));
