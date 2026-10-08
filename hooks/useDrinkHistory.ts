import { useQuery } from '@tanstack/react-query';

import type { PrintedRecipe, Source } from '@/lib/drinkHistory';
import { supabase } from '@/lib/supabase';

// The old books and the recipes printed in them
// (supabase/migrations/20261008120000_drink_history.sql). Row shapes are
// written by hand until types/ is regenerated.

const SOURCE_COLUMNS = 'id, key, kind, title, author, year, edition, city, rights, euvs_url, archive_url, url';
const RECIPE_COLUMNS = `id, item_id, printed_name, page_label, page_url, relation, method, quote, notes,
  source:sources(${SOURCE_COLUMNS}),
  lines:source_recipe_lines(sort_order, ingredient_text, amount_text, amount_ml, note)`;

/** Printed recipes for any of these drinks (a drink and its family), unsorted. */
export function useDrinkHistory(itemIds: readonly string[]) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['drink-history', ids],
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<PrintedRecipe[]> => {
      const { data, error } = await supabase.from('source_recipes').select(RECIPE_COLUMNS).in('item_id', ids);
      if (error) throw error;
      return ((data ?? []) as unknown as PrintedRecipe[]).map((r) => ({
        ...r,
        lines: [...(r.lines ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      }));
    },
  });
}

export interface BookDrink {
  id: string;
  printed_name: string | null;
  page_label: string | null;
  page_url: string | null;
  relation: PrintedRecipe['relation'];
  item: { id: string; name: string } | null;
}

/** A source and the drinks printed in it. */
export function useBook(key: string | null | undefined) {
  return useQuery({
    queryKey: ['book', key],
    enabled: !!key,
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<{
      source: Source;
      drinks: BookDrink[];
    } | null> => {
      const { data, error } = await supabase
        .from('sources')
        .select(`${SOURCE_COLUMNS}, recipes:source_recipes(id, printed_name, page_label, page_url, relation, item:items(id, name))`)
        .eq('key', key!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { recipes, ...source } = data as unknown as Source & {
        recipes: BookDrink[];
      };
      const drinks = [...(recipes ?? [])].sort((a, b) => (a.item?.name ?? '').localeCompare(b.item?.name ?? ''));
      return { source, drinks };
    },
  });
}
