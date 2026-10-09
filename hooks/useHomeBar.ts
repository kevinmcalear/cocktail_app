import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDebounced } from '@/hooks/useDiscover';
import { useDropdowns } from '@/hooks/useDropdowns';
import { chunk } from '@/lib/commandSearchGrid';
import { likeExactly, searchByName } from '@/lib/drinkWizard';
import { barSection, type BarSection } from '@/lib/barSections';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { sortMatches, type MatchRow } from '@/lib/barMatches';
import { specNoteText, type ServedBar } from '@/lib/servedAt';
import { PANTRY, PANTRY_WATER } from '@/lib/pantry';
import { TECHNICAL_INGREDIENTS } from '@/lib/techniques/ingredients';
import { supabase } from '@/lib/supabase';

export interface BarItem {
  id: string;
  name: string;
  type: 'cocktail' | 'ingredient';
  imageUrl: string | null;
  /** Glass icon key, for the drawn placeholder when there's no photo. */
  glass: string | null;
  /** For a drink you can make: the shelf rows it uses (my_bar_drinks). */
  shelfUses?: string[];
  /** The bar a drink is from, so a classic's many bar versions tell apart. */
  from?: { name: string; logo: string | null };
  /** A classic: the bars that pour it as it is ("Served at Harry's Bar, The Gold Room +5"). */
  served?: { count: number; bars: ServedBar[] };
  /** A bar's variation of a classic: what it changes ("uses Rye Whiskey, not Bourbon"). */
  variation?: string;
}

/** A house prep the shelf can make but doesn't have, and every drink that leans on it (my_bar_preps). */
export interface MadePrep {
  id: string;
  name: string;
  drinks: string[];
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
  ingredient_role?: string | null;
  recipes?: { id: string }[] | null;
}

/** A bottle on the shelf, with what the shelf list says about it. */
export interface ShelfItem extends BarItem {
  maker: string | null;
  abv: number | null;
  /** What it's a kind of ("Bourbon"), when the person can see that. */
  kind: string | null;
  /** How many drinks you can make with it. */
  uses: number;
  role?: string | null;
  hasRecipe?: boolean;
  /** When it went on the shelf (for a house prep: when you made it). */
  addedAt?: string | null;
  /** Where My Bar lists it. */
  section: BarSection;
}

/** A search result for the add sheet, with the section it goes in. */
export interface FoundItem extends BarItem {
  section: BarSection;
}

const SHELF_KEY = ['home-bar'];
const NONE: string[] = [];
const ITEM_SELECT = 'id, name, item_type, glassware_id, item_images(angle, sort_order, is_generated, images(url))';
const SHELF_SELECT = `${ITEM_SELECT}, brand_maker, abv, generic_id, ingredient_role, recipes:app_recipe_presentation!recipe_item_id(id)`;

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
 * Ingredients whose name has the text in it, best first, searched on the
 * server so the add sheet never waits on the whole catalog. Each says which
 * My Bar section it goes in; house preps come too, for "I have some".
 */
export function useBarSearch(text: string) {
  const query = useDebounced(text.trim(), 200);
  return useQuery({
    queryKey: ['bar-search', query],
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
    meta: { persist: false },
    queryFn: async (): Promise<FoundItem[]> => {
      // Names that start with it, and any that have it: "Gin" can't sort out of reach behind "Aged gin…".
      const read = (pattern: string, limit: number) =>
        supabase
          .from('app_item_presentation')
          .select('id, name, abv, ingredient_role, item_images(angle, sort_order, is_generated, images(url)), recipes:app_recipe_presentation!recipe_item_id(id)')
          .eq('item_type', 'ingredient')
          .ilike('name', pattern)
          .order('name')
          .order('id')
          .limit(limit);
      const like = likeExactly(query);
      // A lab ingredient goes by several names ("pectinex" is "Pectinase" in the catalog): look for them all.
      const q = query.toLowerCase();
      const aliases = TECHNICAL_INGREDIENTS.find((t) => t.names.some((n) => n.startsWith(q)))?.names.filter((n) => !n.includes(q)) ?? [];
      const [starts, has, also] = await Promise.all([
        read(`${like}%`, 50),
        read(`%${like}%`, 150),
        aliases.length
          ? supabase
              .from('app_item_presentation')
              .select('id, name, abv, ingredient_role, item_images(angle, sort_order, is_generated, images(url)), recipes:app_recipe_presentation!recipe_item_id(id)')
              .eq('item_type', 'ingredient')
              .or(aliases.map((n) => `name.ilike.${likeExactly(n)}`).join(','))
              .limit(10)
          : { data: [], error: null },
      ]);
      if (starts.error) throw starts.error;
      if (has.error) throw has.error;
      if (also.error) throw also.error;
      const byId = new Map([...(starts.data ?? []), ...(has.data ?? [])].map((r) => [r.id, r]));
      const rows = [...byId.values()] as unknown as ItemRow[];
      // Alias matches first: their names don't contain what was typed, so searchByName would drop them.
      const named = (also.data ?? []) as unknown as ItemRow[];
      const found = [...named, ...searchByName(query, rows, 40).filter((r) => !named.some((n) => n.id === r.id))];
      return found.map((r) => ({
        id: r.id,
        name: r.name,
        type: 'ingredient' as const,
        imageUrl: heroPicture(r.item_images)?.url ?? null,
        glass: null,
        section: barSection({ name: r.name, role: r.ingredient_role, abv: r.abv, hasRecipe: !!r.recipes?.length }),
      }));
    },
  });
}

/**
 * The shared catalog's items with these names (any case), in the order given,
 * with the section each goes in: the ideas Add to your bar offers before
 * anything is typed. Names the catalog doesn't have are left out.
 */
export function useBarIdeas(names: readonly string[]) {
  return useQuery({
    queryKey: ['bar-ideas', names],
    enabled: names.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<FoundItem[]> => {
      const { data, error } = await supabase
        .from('app_item_presentation')
        .select('id, name, abv, ingredient_role, item_images(angle, sort_order, is_generated, images(url)), recipes:app_recipe_presentation!recipe_item_id(id)')
        .eq('item_type', 'ingredient')
        .is('bar_id', null)
        .or(names.map((n) => `name.ilike."${likeExactly(n).replace(/"/g, '\\"')}"`).join(','))
        .order('id');
      if (error) throw error;
      // One per name, the first by id, as the pantry staples are picked.
      const byName = new Map<string, ItemRow>();
      for (const r of (data ?? []) as unknown as ItemRow[]) if (!byName.has(r.name.toLowerCase())) byName.set(r.name.toLowerCase(), r);
      return names.flatMap((n) => {
        const r = byName.get(n.toLowerCase());
        if (!r) return [];
        return [{
          id: r.id,
          name: r.name,
          type: 'ingredient' as const,
          imageUrl: heroPicture(r.item_images)?.url ?? null,
          glass: null,
          section: barSection({ name: r.name, role: r.ingredient_role, abv: r.abv, hasRecipe: !!r.recipes?.length }),
        }];
      });
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
 * The preps your shelf can make that aren't on it yet, most-used first: My
 * Bar's "Make first". Under the shelf's key, so a shelf change refreshes it.
 */
export function useMadePreps() {
  return useQuery({
    queryKey: [...SHELF_KEY, 'preps'],
    queryFn: async (): Promise<MadePrep[]> => {
      const { data, error } = await supabase.rpc('my_bar_preps');
      // ponytail: a database without 20261010400000 has no my_bar_preps; show no Make first. Drop once it's in production.
      if (error?.code === 'PGRST202') return [];
      if (error) throw error;
      return (data ?? []) as MadePrep[];
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
    const drink = (r: MatchRow): BarItem => ({
      id: r.id,
      name: r.name,
      type: 'cocktail',
      imageUrl: r.image_url,
      glass: glass(r.glassware_id),
      shelfUses: r.uses ?? undefined,
      from: r.from_name ? { name: r.from_name, logo: r.from_logo ?? null } : undefined,
      // Read only when there: older servers don't send these.
      served: r.served_count && r.served_at?.length ? { count: r.served_count, bars: r.served_at } : undefined,
      variation: r.spec_match === 'variation' ? specNoteText(r.spec_note) ?? 'a variation' : undefined,
    });
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
async function readShelf(ids: string[]): Promise<Omit<ShelfItem, 'uses' | 'section'>[]> {
  const [rows, added] = await Promise.all([
    readItems(ids, SHELF_SELECT),
    supabase.from('home_bar_items').select('item_id, added_at'),
  ]);
  if (added.error) throw added.error;
  const addedAt = new Map((added.data ?? []).map((r: { item_id: string; added_at: string }) => [r.item_id, r.added_at]));
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
    role: r.ingredient_role ?? null,
    hasRecipe: !!r.recipes?.length,
    addedAt: addedAt.get(r.id) ?? null,
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
      // Worked out here, not saved, so a saved shelf from an older app still gets sorted.
      return r ? [{ ...r, uses: drinks.usedIn[id] ?? 0, section: barSection(r) }] : [];
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

