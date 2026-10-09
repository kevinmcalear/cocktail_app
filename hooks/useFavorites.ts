import { supabase } from '@/lib/supabase';
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

const DRINK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Moves this device's hearted drinks onto the account, as To make in
 * Collection (collected_items). Cocktail hearts are bare ids; beer, wine and
 * ingredient hearts are prefixed and stay here. A heart the database refuses
 * for now (no confirmed age yet) stays on the device to try again next time;
 * one for a drink that's gone is dropped.
 */
export async function moveHeartsToCollection(): Promise<void> {
  let ids: unknown;
  try {
    ids = JSON.parse((await deviceStore.getItem(FAVORITES_KEY)) ?? '[]');
  } catch {
    return;
  }
  if (!Array.isArray(ids)) return;
  const drinks = ids.filter((id): id is string => typeof id === 'string' && DRINK_ID.test(id));
  if (!drinks.length) return;
  const kept = ids.filter((id) => !drinks.includes(id));
  for (const id of drinks) {
    const { error } = await supabase.from('collected_items').insert({ item_id: id });
    // 23505: already saved. 23503: the drink was deleted.
    if (error && error.code !== '23505' && error.code !== '23503') kept.push(id);
  }
  await deviceStore.setItem(FAVORITES_KEY, JSON.stringify(kept));
}
