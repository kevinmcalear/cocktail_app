import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

const FAVORITES_KEY = 'cocktail_favorites';

export function useFavorites() {
    const [favorites, setFavorites] = useState<string[]>([]);

    useEffect(() => {
        const loadFavorites = async () => {
            try {
                const stored = await SecureStore.getItemAsync(FAVORITES_KEY);
                if (stored) {
                    setFavorites(JSON.parse(stored));
                }
            } catch (error) {
                console.error('Error loading favorites:', error);
            }
        };
        loadFavorites();
    }, []);

    const toggleFavorite = useCallback(async (id: string) => {
        try {
            const newFavorites = favorites.includes(id)
                ? favorites.filter(f => f !== id)
                : [...favorites, id];

            setFavorites(newFavorites);
            await SecureStore.setItemAsync(FAVORITES_KEY, JSON.stringify(newFavorites));
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    }, [favorites]);

    const isFavorite = useCallback((id: string) => {
        return favorites.includes(id);
    }, [favorites]);

    return { favorites, toggleFavorite, isFavorite };
}
