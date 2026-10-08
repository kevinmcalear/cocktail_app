import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDebounced } from '@/hooks/useDiscover';
import { useDropdowns } from '@/hooks/useDropdowns';
import { chunk } from '@/lib/commandSearchGrid';
import { likeExactly, searchByName } from '@/lib/drinkWizard';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { sortMatches, type MatchRow } from '@/lib/barMatches';
import { PANTRY, PANTRY_WATER } from '@/lib/pantry';
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
  brand_maker?: string | null;
  abv?: number | null;
  generic_id?: string | null;
}

/** A bottle on the shelf, with what the shelf list says about it. */
export interface ShelfItem extends BarItem {
  maker: string | null;
  abv: number | null;
  /** What it's a kind of ("Bourbon"), when the person can see that. */
  kind: string | null;
  /** How many drinks you can make with it. */
  uses: number;
}

const SHELF_KEY = ['home-bar'];
const NONE: string[] = [];
const ITEM_SELECT = 'id, name, item_type, glassware_id, item_images(angle, sort_order, is_generated, images(url))';
const SHELF_SELECT = `${ITEM_SELECT}, brand_maker, abv, generic_id`;

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
  // One bottle or several (the pantry's "I have all of these"); ones already on the shelf are left as they are.
  const add = useMutation({
    mutationFn: async (itemIds: string | string[]) => {
      const rows = [itemIds].flat().map((item_id) => ({ item_id }));
      const { error } = await supabase.from('home_bar_items').upsert(rows, { onConflict: 'user_id,item_id', ignoreDuplicates: true });
      if (error) throw error;
    },
    onMutate: (itemIds) => onMutateWith((ids) => [...[itemIds].flat(), ...ids.filter((i) => ![itemIds].flat().includes(i))])(),
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
async function readItems(ids: string[], select = ITEM_SELECT): Promise<ItemRow[]> {
  const batches = await Promise.all(
    chunk(ids, 150).map(async (batch) => {
      const { data, error } = await supabase.from('app_item_presentation').select(select).in('id', batch);
      if (error) throw error;
      return (data ?? []) as unknown as ItemRow[];
    })
  );
  return batches.flat();
}

/** What the shelf makes, and what one or two more bottles would unlock, worked out on the server (my_bar_drinks). */
function useMatches() {
  return useQuery({
    queryKey: [...SHELF_KEY, 'matches', 2],
    queryFn: async (): Promise<MatchRow[]> => {
      const rows: MatchRow[] = [];
      let twoAway = true;
      for (;;) {
        const last = rows[rows.length - 1];
        const args = { p_after_name: last?.name ?? null, p_after_id: last?.id ?? null, p_limit: 1000 };
        let { data, error } = await supabase.rpc('my_bar_drinks', twoAway ? { ...args, p_two_away: true } : args);
        // ponytail: a database without 20261009950000 doesn't know p_two_away; ask without it. Drop once it's in production.
        if (error?.code === 'PGRST202' && twoAway) {
          twoAway = false;
          ({ data, error } = await supabase.rpc('my_bar_drinks', args));
        }
        if (error) throw error;
        rows.push(...((data ?? []) as MatchRow[]));
        if ((data ?? []).length < 1000) return rows;
      }
    },
  });
}

/**
 * What the shelf makes and what one or two more bottles would unlock,
 * without the shelf's own names: all the eight ball needs, so it never waits on them.
 */
export function useBarDrinks() {
  const matches = useMatches();
  const glass = useGlassIcons();
  return useMemo(() => {
    const drink = (r: MatchRow): BarItem => ({ id: r.id, name: r.name, type: 'cocktail', imageUrl: r.image_url, glass: glass(r.glassware_id) });
    const sorted = sortMatches(matches.data ?? [], drink);
    const bottle = (b: { id: string; name: string }): BarItem => ({ id: b.id, name: b.name, type: 'ingredient', imageUrl: null, glass: null });
    return {
      canMake: sorted.canMake,
      oneAway: sorted.oneAway.map((g) => ({ bottles: g.buy.map(bottle), drinks: g.drinks })),
      twoAway: sorted.twoAway.map((g) => ({ bottles: g.buy.map(bottle), drinks: g.drinks })),
      /** Shelf row id to the number of drinks you can make with it. */
      usedIn: sorted.usedIn,
      canMakeIds: new Set(sorted.canMake.map((d) => d.id)),
      isLoading: matches.isLoading,
      error: matches.error,
    };
  }, [matches.data, matches.isLoading, matches.error, glass]);
}

/** The shelf's bottles with what each is a kind of: the bottles, then the kinds' names. */
async function readShelf(ids: string[]): Promise<Omit<ShelfItem, 'uses'>[]> {
  const rows = await readItems(ids, SHELF_SELECT);
  const kindIds = [...new Set(rows.map((r) => r.generic_id).filter((id): id is string => !!id))];
  const kinds = new Map((kindIds.length ? await readItems(kindIds, 'id, name') : []).map((k) => [k.id, k.name]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.item_type,
    imageUrl: heroPicture(r.item_images)?.url ?? null,
    glass: null,
    maker: r.brand_maker ?? null,
    abv: r.abv ?? null,
    kind: (r.generic_id && kinds.get(r.generic_id)) || null,
  }));
}

/** My Bar: the shelf, what it makes, and what one more bottle would unlock. */
export function useMyBar() {
  const shelf = useShelf();
  const drinks = useBarDrinks();
  const ids = shelf.data ?? NONE;
  const names = useQuery({
    queryKey: [...SHELF_KEY, 'items', ids],
    enabled: ids.length > 0,
    // The last shelf stays up while a changed one loads, so the list doesn't blank and jump on every tap.
    placeholderData: keepPreviousData,
    queryFn: () => readShelf(ids),
  });

  return useMemo(() => {
    const byId = new Map((names.data ?? []).map((r) => [r.id, r]));
    // The shelf in the order it was filled, as far as the person can still see it.
    const onShelf = ids.flatMap((id) => {
      const r = byId.get(id);
      return r ? [{ ...r, uses: drinks.usedIn[id] ?? 0 }] : [];
    });
    return {
      shelf: onShelf,
      canMake: drinks.canMake,
      oneAway: drinks.oneAway,
      twoAway: drinks.twoAway,
      usedIn: drinks.usedIn,
      canMakeIds: drinks.canMakeIds,
      /** Everything on the shelf, before names load. */
      shelfIds: new Set(ids),
      isLoading: shelf.isLoading || drinks.isLoading || (ids.length > 0 && names.isLoading),
      error: shelf.error ?? drinks.error ?? names.error,
    };
  }, [ids, shelf.isLoading, shelf.error, drinks, names.data, names.isLoading, names.error]);
}

/**
 * The pantry staples (lib/pantry.ts) as shared ingredients, by name. A staple
 * the catalog doesn't have is left out.
 */
export function usePantryItems() {
  return useQuery({
    queryKey: ['pantry-items'],
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<{ name: string; id: string }[]> => {
      const names = [...PANTRY.map((p) => p.name), PANTRY_WATER];
      const { data, error } = await supabase
        .from('app_item_presentation')
        .select('id, name')
        .eq('item_type', 'ingredient')
        .is('bar_id', null)
        .in('name', names)
        .order('id');
      if (error) throw error;
      // One row per name (the shared list has one of each since 20261008100200).
      const byName = new Map<string, string>();
      for (const r of (data ?? []) as { id: string; name: string }[]) if (!byName.has(r.name)) byName.set(r.name, r.id);
      return names.flatMap((name) => {
        const id = byName.get(name);
        return id ? [{ name, id }] : [];
      });
    },
  });
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

