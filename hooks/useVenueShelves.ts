import { useMemo } from 'react';

import { useAllIngredients } from '@/hooks/useDropdowns';
import { type ItemImageLink } from '@/lib/itemImages';
import { venueShelves, type ShelfIngredient } from '@/lib/libraryFilters';
import type { SearchItem } from '@/types/search';

type Shelves = Record<'preps' | 'garnishes' | 'bottles', SearchItem[]>;
const EMPTY: Shelves = { preps: [], garnishes: [], bottles: [] };

/**
 * The Library's Preps, Garnishes and Bottles at a venue, as tiles. The venue's
 * own ingredients come from `items` (with their batch photos); shared ones its
 * drinks use come from the ingredient list everyone shares.
 */
export function useVenueShelves(venueId: string | null, items: SearchItem[]): Shelves {
  const { data: ingredients } = useAllIngredients({ enabled: !!venueId });
  return useMemo(() => {
    if (!venueId || !ingredients) return EMPTY;
    type Row = ShelfIngredient & { name: string; item_images?: ItemImageLink[] | null };
    const rows = ingredients as unknown as Row[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const own = new Map(items.filter((i) => i.category === 'Ingredient').map((i) => [i.id, i]));
    const tile = (id: string): SearchItem | null => {
      const r = byId.get(id);
      if (own.has(id)) return own.get(id)!;
      return r ? { id, name: r.name, category: 'Ingredient', item_images: r.item_images ?? undefined } : null;
    };
    const shelves = venueShelves(venueId, items.filter((i) => i.category === 'Cocktail'), rows);
    const tiles = (ids: string[]) => ids.map(tile).filter((t): t is SearchItem => !!t);
    return { preps: tiles(shelves.preps), garnishes: tiles(shelves.garnishes), bottles: tiles(shelves.bottles) };
  }, [venueId, ingredients, items]);
}
