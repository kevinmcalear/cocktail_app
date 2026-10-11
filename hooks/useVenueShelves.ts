import { useMemo } from 'react';

import { useAllIngredients, useIngredientsById } from '@/hooks/useDropdowns';
import { byName } from '@/lib/allRows';
import { type ItemImageLink } from '@/lib/itemImages';
import { venueShelves, type ShelfIngredient } from '@/lib/libraryFilters';
import type { SearchItem } from '@/types/search';

type Shelves = Record<'preps' | 'garnishes' | 'bottles', SearchItem[]>;
const EMPTY: Shelves = { preps: [], garnishes: [], bottles: [] };

/**
 * The Library's Preps, Garnishes and Bottles at a venue, as tiles. The venue's
 * own ingredients come from `items` (with their batch photos); shared ones its
 * drinks use are read by id, not from the whole ~15,000-row list.
 */
export function useVenueShelves(venueId: string | null, items: SearchItem[]): Shelves {
  const usedIds = useMemo(
    () => items.flatMap((i) => (i.category === 'Cocktail' ? (i.recipes ?? []).map((l) => l.display_ingredient_id) : [])).filter((id): id is string => !!id),
    [items]
  );
  const barIds = useMemo(() => (venueId ? [venueId] : []), [venueId]);
  const { data: venueRows } = useAllIngredients({ barIds, enabled: !!venueId });
  const { data: used } = useIngredientsById(usedIds);
  return useMemo(() => {
    if (!venueId || !venueRows || (usedIds.length && !used)) return EMPTY;
    type Row = ShelfIngredient & { name: string; item_images?: ItemImageLink[] | null };
    const rows = [...new Map([...venueRows, ...(used ?? [])].map((r) => [r.id, r])).values()].sort(byName) as unknown as Row[];
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
  }, [venueId, venueRows, used, usedIds.length, items]);
}
