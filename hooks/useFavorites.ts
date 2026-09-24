import { deviceStore } from '@/lib/deviceStore';
import { useCallback, useEffect, useState } from 'react';

export const FAVORITES_KEY = 'cocktail_favorites';

export function useFavorites() {
    const [favorites, setFavorites] = useState<string[]>([]);

    useEffect(() => {
        const loadFavorites = async () => {
            try {
                const stored = await deviceStore.getItem(FAVORITES_KEY);
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
            await deviceStore.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    }, [favorites]);

    const isFavorite = useCallback((id: string) => {
        return favorites.includes(id);
    }, [favorites]);

    return { favorites, toggleFavorite, isFavorite };
}
