import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAllIngredients } from '@/hooks/useDropdowns';
import { type ItemImageLink } from '@/lib/itemImages';
import { prepGroup, tileLine, venueShelves, yieldText, type PrepGroup, type ShelfIngredient } from '@/lib/libraryFilters';
import { shelfLifeLabel } from '@/lib/scale';
import { supabase } from '@/lib/supabase';
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

interface PrepRow {
  item_id: string;
  yield_amount: number | null;
  yield_unit: string | null;
  shelf_life_hours: number | null;
  actions: string[] | null;
}

export interface PrepFacts {
  group: PrepGroup | null;
  /** "Cordial · 1 L · keeps 2 weeks". */
  line: string | null;
}

/**
 * The Preps shelf's tiles' facts: what was done (Syrups, Cordials...), yield
 * and how long it keeps, from each prep's card (item_prep). A prep with no card
 * still gets its group from its name.
 * ponytail: one request for the shelf's ids (a venue has tens of preps, under
 * the 1,000-row page); page it if a shelf ever passes that.
 */
export function usePrepFacts(preps: SearchItem[]): Record<string, PrepFacts> {
  const ids = useMemo(() => preps.map((p) => p.id).sort(), [preps]);
  const { data } = useQuery({
    queryKey: ['prep-facts', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PrepRow[]> => {
      const { data, error } = await supabase.from('item_prep').select('item_id, yield_amount, yield_unit, shelf_life_hours, actions').in('item_id', ids);
      if (error) throw error;
      return (data ?? []) as PrepRow[];
    },
  });
  return useMemo(() => {
    const cards = new Map((data ?? []).map((r) => [r.item_id, r]));
    const out: Record<string, PrepFacts> = {};
    for (const p of preps) {
      const card = cards.get(p.id);
      const group = prepGroup(p.name, card?.actions ?? []);
      const keeps = shelfLifeLabel(card?.shelf_life_hours ?? null);
      out[p.id] = { group, line: tileLine(group, yieldText(card?.yield_amount, card?.yield_unit), keeps ? `keeps ${keeps}` : null) };
    }
    return out;
  }, [data, preps]);
}
