import { create } from 'zustand';

interface AppState {
    draftCocktailId: string | null;
    setDraftCocktailId: (id: string | null) => void;
    
    // Bar Management Context
    selectedBarId: string | null;
    setSelectedBarId: (id: string | null) => void;
    // Add more temporary app state here as needed 
    // e.g., active menu, temporary selections, ui state
}

export const useAppStore = create<AppState>((set) => ({
    draftCocktailId: null,
    setDraftCocktailId: (id) => set({ draftCocktailId: id }),
    selectedBarId: null,
    setSelectedBarId: (id) => set({ selectedBarId: id }),
}));
