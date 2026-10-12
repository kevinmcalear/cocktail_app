import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { chunk } from '@/lib/commandSearchGrid';
import { ingredientLine } from '@/lib/menus';
import { sortRecipesByOrder } from '@/lib/recipeUtils';
import { supabase } from '@/lib/supabase';

/** Where a drink comes from, for the line under its name in a short list: "Classic", "Morgenthaler", "Little Rye · Melbourne". */
export interface DrinkSource {
  /** "Classic" for catalog classics, else who made it (the creator, then the bar). */
  by: string | null;
  /** The city of the bar it was first poured at. */
  city: string | null;
  classic: boolean;
  /** Names a classic it riffs on. */
  riff: boolean;
  /** Bars' versions of it (drinks naming it as their classic): "3 bar versions". */
  versions: number;
}

interface SourceRow {
  id: string;
  is_catalog: boolean | null;
  origin: string | null;
  riff_of_id: string | null;
  creator: { display_name: string } | null;
  origin_bar: { display_name: string; city: string | null } | null;
  versions: { count: number }[] | null;
}

/**
 * Who made each of these drinks (only the ones this person can read), for
 * the source line on prep "In 58 drinks" rows and pairing rows, and how
 * many bar versions a classic has (book pages).
 */
export function useDrinkSources(itemIds: readonly string[]) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['drink-sources', ids],
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Record<string, DrinkSource>> => {
      const batches = await Promise.all(
        chunk(ids, 150).map(async (batch) => {
          const { data, error } = await supabase
            .from('items')
            .select('id, is_catalog, origin, riff_of_id, creator:profiles!items_creator_profile_id_fkey(display_name), origin_bar:profiles!items_origin_bar_profile_id_fkey(display_name, city), versions:items!riff_of_id(count)')
            .in('id', batch)
            .eq('versions.is_catalog', false);
          if (error) throw error;
          return (data ?? []) as unknown as SourceRow[];
        })
      );
      return Object.fromEntries(
        batches.flat().map((r) => {
          const classic = !!r.is_catalog || r.origin === 'Classic';
          return [r.id, { by: classic ? 'Classic' : (r.creator?.display_name ?? r.origin_bar?.display_name ?? null), city: r.origin_bar?.city ?? null, classic, riff: !classic && !!r.riff_of_id, versions: r.versions?.[0]?.count ?? 0 }];
        })
      );
    },
  });
}

type LineRow = { id: string; recipes: { sort_order: number | null; created_at?: string; display_ingredient: { name: string } | { name: string }[] | null }[] | null };
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Each drink's ingredients in spec order ("Gin, Campari, Sweet Vermouth"), for a classic's search caption. */
export function useDrinkLines(itemIds: readonly string[]) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['drink-lines', ids],
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, recipes:app_recipe_presentation!recipe_item_id(sort_order, created_at, display_ingredient(name))')
        .in('id', ids.slice(0, 100));
      if (error) throw error;
      return Object.fromEntries(
        ((data ?? []) as unknown as LineRow[]).map((r) => [r.id, ingredientLine(sortRecipesByOrder(r.recipes ?? []).map((x) => one(x.display_ingredient)?.name))])
      );
    },
  });
}
