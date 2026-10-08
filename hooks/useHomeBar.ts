import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDebounced } from '@/hooks/useDiscover';
import { useDropdowns } from '@/hooks/useDropdowns';
import { chunk } from '@/lib/commandSearchGrid';
import { likeExactly, searchByName } from '@/lib/drinkWizard';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { supabase } from '@/lib/supabase';

export interface BarItem {
  id: string;
  name: string;
  type: 'cocktail' | 'ingredient';
  imageUrl: string | null;
  /** Glass icon key, for the drawn placeholder when there's no photo. */
  glass: string | null;
}

interface ItemRow {
  id: string;
  name: string;
  item_type: 'cocktail' | 'ingredient';
  glassware_id?: string | null;
  item_images: ItemImageLink[] | null;
}

/** A row of my_bar_drinks (supabase/migrations/20261008340000_my_bar_rpc.sql). */
interface MatchRow {
  id: string;
  name: string;
  image_url: string | null;
  glassware_id: string | null;
  /** The bottle that would make it, or null when the shelf already does. */
  missing_id: string | null;
  missing_name: string | null;
}

const SHELF_KEY = ['home-bar'];
const NONE: string[] = [];
const ITEM_SELECT = 'id, name, item_type, glassware_id, item_images(angle, sort_order, is_generated, images(url))';
/** "Make it yourself" loads this many drinks at a time as the list scrolls. */
const OTHERS_PAGE = 50;

/** The bottles on the signed-in person's shelf (item ids, newest first). */
export function useShelf() {
  return useQuery({
    queryKey: SHELF_KEY,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('home_bar_items')
        .select('item_id')
        .order('added_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: { item_id: string }) => r.item_id);
    },
  });
}

/**
 * Bottles whose name has the text in it, best first, searched on the server
 * so the add sheet never waits on the whole catalog. House-made preps are
 * left out: the shelf works those out from their recipes.
 */
export function useBottleSearch(text: string) {
  const query = useDebounced(text.trim(), 200);
  return useQuery({
    queryKey: ['bottle-search', query],
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
    meta: { persist: false },
    queryFn: async (): Promise<BarItem[]> => {
      // Names that start with it, and any that have it: "Gin" can't sort out of reach behind "Aged gin…".
      const read = (pattern: string, limit: number) =>
        supabase
          .from('app_item_presentation')
          .select('id, name, item_images(angle, sort_order, is_generated, images(url)), recipes:app_recipe_presentation!recipe_item_id(id)')
          .eq('item_type', 'ingredient')
          .is('recipes', null)
          .ilike('name', pattern)
          .order('name')
          .order('id')
          .limit(limit);
      const like = likeExactly(query);
      const [starts, has] = await Promise.all([read(`${like}%`, 50), read(`%${like}%`, 150)]);
      if (starts.error) throw starts.error;
      if (has.error) throw has.error;
      const byId = new Map([...(starts.data ?? []), ...(has.data ?? [])].map((r) => [r.id, r]));
      const rows = [...byId.values()] as unknown as Pick<ItemRow, 'id' | 'name' | 'item_images'>[];
      return searchByName(query, rows, 40).map((r) => ({
        id: r.id,
        name: r.name,
        type: 'ingredient' as const,
        imageUrl: heroPicture(r.item_images)?.url ?? null,
        glass: null,
      }));
    },
  });
}

/** Add or remove a bottle. The row's owner defaults to the caller. */
export function useShelfEdit() {
  const client = useQueryClient();
  // The shelf, its names and what it makes all sit under SHELF_KEY.
  const onSettled = () => client.invalidateQueries({ queryKey: SHELF_KEY });
  const onMutateWith = (change: (ids: string[]) => string[]) => () => {
    const before = client.getQueryData<string[]>(SHELF_KEY);
    client.setQueryData<string[]>(SHELF_KEY, (ids) => change(ids ?? []));
    return { before };
  };
  const add = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('home_bar_items').insert({ item_id: itemId });
      if (error) throw error;
    },
    onMutate: (itemId) => onMutateWith((ids) => [itemId, ...ids.filter((i) => i !== itemId)])(),
    onError: (_e, _id, ctx) => client.setQueryData(SHELF_KEY, ctx?.before),
    onSettled,
  });
  const remove = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('home_bar_items').delete().eq('item_id', itemId);
      if (error) throw error;
    },
    onMutate: (itemId) => onMutateWith((ids) => ids.filter((i) => i !== itemId))(),
    onError: (_e, _id, ctx) => client.setQueryData(SHELF_KEY, ctx?.before),
    onSettled,
  });
  return { add, remove };
}

/** Glassware id to its icon key, for drawn placeholders. */
function useGlassIcons(): (id: string | null | undefined) => string | null {
  const { data: dropdowns } = useDropdowns();
  return useMemo(() => {
    const icons = new Map<string, string>();
    for (const g of (dropdowns?.glassware ?? []) as { id: string; name: string; icon_key?: string | null }[]) icons.set(g.id, g.icon_key || g.name);
    return (id) => (id ? (icons.get(id) ?? null) : null);
  }, [dropdowns?.glassware]);
}

/** Items the person can see, by id, in URL-sized batches (shelf names, hearted drinks). */
async function readItems(ids: string[]): Promise<ItemRow[]> {
  const batches = await Promise.all(
    chunk(ids, 150).map(async (batch) => {
      const { data, error } = await supabase.from('app_item_presentation').select(ITEM_SELECT).in('id', batch);
      if (error) throw error;
      return (data ?? []) as unknown as ItemRow[];
    })
  );
  return batches.flat();
}

/** What the shelf makes and what one more bottle would unlock, worked out on the server (my_bar_drinks). */
function useMatches() {
  return useQuery({
    queryKey: [...SHELF_KEY, 'matches'],
    queryFn: async (): Promise<MatchRow[]> => {
      const rows: MatchRow[] = [];
      for (;;) {
        const last = rows[rows.length - 1];
        const { data, error } = await supabase.rpc('my_bar_drinks', { p_after_name: last?.name ?? null, p_after_id: last?.id ?? null, p_limit: 1000 });
        if (error) throw error;
        rows.push(...((data ?? []) as MatchRow[]));
        if ((data ?? []).length < 1000) return rows;
      }
    },
  });
}

/**
 * What the shelf makes and what one more bottle would unlock, without the
 * shelf's own names: all the eight ball needs, so it never waits on them.
 */
export function useBarDrinks() {
  const matches = useMatches();
  const glass = useGlassIcons();
  return useMemo(() => {
    const drink = (r: MatchRow): BarItem => ({ id: r.id, name: r.name, type: 'cocktail', imageUrl: r.image_url, glass: glass(r.glassware_id) });
    const rows = matches.data ?? [];
    const canMake = rows.filter((r) => !r.missing_id).map(drink);
    const away = new Map<string, { ingredient: BarItem; drinks: BarItem[] }>();
    for (const r of rows) {
      if (!r.missing_id) continue;
      const group = away.get(r.missing_id) ?? {
        ingredient: { id: r.missing_id, name: r.missing_name ?? '', type: 'ingredient' as const, imageUrl: null, glass: null },
        drinks: [],
      };
      group.drinks.push(drink(r));
      away.set(r.missing_id, group);
    }
    return {
      canMake,
      // Most drinks unlocked first, as lib/canMake.ts sorted them.
      oneAway: [...away.values()].sort((a, b) => b.drinks.length - a.drinks.length || a.ingredient.id.localeCompare(b.ingredient.id)),
      canMakeIds: new Set(canMake.map((d) => d.id)),
      isLoading: matches.isLoading,
      error: matches.error,
    };
  }, [matches.data, matches.isLoading, matches.error, glass]);
}

/** My Bar: the shelf, what it makes, and what one more bottle would unlock. */
export function useMyBar() {
  const shelf = useShelf();
  const drinks = useBarDrinks();
  const ids = shelf.data ?? NONE;
  const names = useQuery({
    queryKey: [...SHELF_KEY, 'items', ids],
    enabled: ids.length > 0,
    queryFn: () => readItems(ids),
  });

  return useMemo(() => {
    const byId = new Map((names.data ?? []).map((r) => [r.id, r]));
    // The shelf in the order it was filled, as far as the person can still see it.
    const onShelf = ids.flatMap((id) => {
      const r = byId.get(id);
      return r ? [{ id: r.id, name: r.name, type: r.item_type, imageUrl: heroPicture(r.item_images)?.url ?? null, glass: null }] : [];
    });
    return {
      shelf: onShelf,
      canMake: drinks.canMake,
      oneAway: drinks.oneAway,
      canMakeIds: drinks.canMakeIds,
      /** Everything on the shelf, before names load. */
      shelfIds: new Set(ids),
      isLoading: shelf.isLoading || drinks.isLoading || (ids.length > 0 && names.isLoading),
      error: shelf.error ?? drinks.error ?? names.error,
    };
  }, [ids, shelf.isLoading, shelf.error, drinks, names.data, names.isLoading, names.error]);
}

/**
 * Every drink the person can see, A to Z, a page at a time as the list
 * scrolls: My Bar's "Make it yourself". Kept in memory only.
 */
export function useAllDrinks() {
  const glass = useGlassIcons();
  const query = useInfiniteQuery({
    queryKey: ['home-bar-drinks'],
    meta: { persist: false },
    initialPageParam: 0,
    getNextPageParam: (last: ItemRow[], pages) => (last.length < OTHERS_PAGE ? undefined : pages.length * OTHERS_PAGE),
    queryFn: async ({ pageParam }): Promise<ItemRow[]> => {
      const { data, error } = await supabase
        .from('app_item_presentation')
        .select(ITEM_SELECT)
        .eq('item_type', 'cocktail')
        .order('name')
        .order('id')
        .range(pageParam, pageParam + OTHERS_PAGE - 1);
      if (error) throw error;
      return (data ?? []) as unknown as ItemRow[];
    },
  });
  const drinks = useMemo(
    () =>
      (query.data?.pages ?? []).flat().map(
        (r): BarItem => ({ id: r.id, name: r.name, type: 'cocktail', imageUrl: heroPicture(r.item_images)?.url ?? null, glass: glass(r.glassware_id) })
      ),
    [query.data, glass]
  );
  return { drinks, loadMore: () => (query.hasNextPage && !query.isFetchingNextPage ? query.fetchNextPage() : undefined), isLoading: query.isLoading };
}

/** These drinks, by id, as the person can see them (hearted drinks on Collection). */
export function useDrinksById(ids: readonly string[]) {
  const glass = useGlassIcons();
  const sorted = [...ids].sort();
  const query = useQuery({
    queryKey: ['drinks-by-id', sorted],
    enabled: sorted.length > 0,
    queryFn: () => readItems(sorted),
  });
  const drinks = useMemo(() => {
    const byId = new Map((query.data ?? []).filter((r) => r.item_type === 'cocktail').map((r) => [r.id, r]));
    return ids.flatMap((id) => {
      const r = byId.get(id);
      return r ? [{ id: r.id, name: r.name, type: 'cocktail' as const, imageUrl: heroPicture(r.item_images)?.url ?? null, glass: glass(r.glassware_id) }] : [];
    });
  }, [ids, query.data, glass]);
  return { drinks, isLoading: query.isLoading };
}

