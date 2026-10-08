import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// What pairs with what, counted from drinks anyone can read
// (supabase/migrations/20261008110000_ingredient_pairs.sql). Row shapes are
// written by hand until types/ is regenerated.

export type PairEra = 'now' | 'books';

export interface Pairing {
  id: string;
  name: string;
  /** Drinks (in this era) that use it at all. */
  drinks: number;
  /** Drinks it shares with each ingredient asked about, in the order asked. */
  together: number[];
  score: number;
}

interface PairingRow {
  item_id: string;
  name: string;
  drinks: number | null;
  together: number[];
  score: number;
}

/**
 * What goes with every one of `ids` (each read as its core ingredient: a
 * Tanqueray counts as London Dry Gin), best first. Empty when nothing is
 * asked, or nothing pairs with all of them.
 */
export function usePairings(ids: readonly string[], { era = 'now', limit = 18 }: { era?: PairEra; limit?: number } = {}) {
  const asked = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['pairings', era, limit, asked],
    enabled: asked.length > 0,
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<Pairing[]> => {
      // Ask in the order given, so together[] lines up with `ids`.
      const { data, error } = await supabase.rpc('get_pairings', { p_ids: [...new Set(ids)], p_era: era, p_limit: limit });
      if (error) throw error;
      return ((data ?? []) as PairingRow[]).map((r) => ({
        id: r.item_id,
        name: r.name,
        drinks: r.drinks ?? 0,
        together: r.together ?? [],
        score: Number(r.score),
      }));
    },
  });
}

export interface PairDrink {
  id: string;
  name: string;
  isCatalog: boolean;
}

/** The drinks behind a pairing: ones anyone can read that use both. */
export function usePairDrinks(a: string | null, b: string | null) {
  return useQuery({
    queryKey: ['pair-drinks', a, b],
    enabled: !!a && !!b,
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<PairDrink[]> => {
      const { data, error } = await supabase.rpc('get_pair_drinks', { p_a: a!, p_b: b!, p_limit: 12 });
      if (error) throw error;
      return ((data ?? []) as { id: string; name: string; is_catalog: boolean }[]).map((d) => ({ id: d.id, name: d.name, isCatalog: d.is_catalog }));
    },
  });
}
