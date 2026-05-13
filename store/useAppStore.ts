import { create } from 'zustand';

interface AppState {
    draftCocktailId: string | null;
    setDraftCocktailId: (id: string | null) => void;
    
    // Bar Management Context
    selectedBarId: string | null;
    setSelectedBarId: (id: string | null) => void;
    // Cross-screen creation return values
    recentlyCreatedItem: { type: 'cocktail' | 'ingredient', id: string, name: string } | null;
    setRecentlyCreatedItem: (item: { type: 'cocktail' | 'ingredient', id: string, name: string } | null) => void;
    // Add more temporary app state here as needed
}

export const useAppStore = create<AppState>((set) => ({
    draftCocktailId: null,
    setDraftCocktailId: (id) => set({ draftCocktailId: id }),
    selectedBarId: null,
    setSelectedBarId: (id) => set({ selectedBarId: id }),
    recentlyCreatedItem: null,
    setRecentlyCreatedItem: (item) => set({ recentlyCreatedItem: item }),
}));
