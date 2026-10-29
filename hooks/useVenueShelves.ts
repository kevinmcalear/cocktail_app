import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useIngredientsById, useVenueIngredients } from '@/hooks/useDropdowns';
import { byName } from '@/lib/allRows';
import { prepGroup, tileLine, venueShelves, yieldText, type PrepGroup } from '@/lib/libraryFilters';
import { shelfLifeLabel } from '@/lib/scale';
import { supabase } from '@/lib/supabase';
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
  const { data: venueRows } = useVenueIngredients(barIds, !!venueId);
  const { data: used } = useIngredientsById(usedIds);
  return useMemo(() => {
    if (!venueId || !venueRows || (usedIds.length && !used)) return EMPTY;
    const rows = [...new Map([...venueRows, ...(used ?? [])].map((r) => [r.id, r])).values()].sort(byName);
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
