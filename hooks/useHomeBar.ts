import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDropdowns } from '@/hooks/useDropdowns';
import { allRows } from '@/lib/allRows';
import { canMake, type RecipeRow } from '@/lib/canMake';
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

interface CatalogRow {
  id: string;
  name: string;
  item_type: 'cocktail' | 'ingredient';
  glassware_id: string | null;
  item_images: ItemImageLink[] | null;
  recipes: { display_ingredient_id: string | null; parent_ingredient_id: string | null; is_optional: boolean | null }[] | null;
}

const SHELF_KEY = ['home-bar'];

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

/** Add or remove a bottle. The row's owner defaults to the caller. */
export function useShelfEdit() {
  const client = useQueryClient();
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

/**
 * Every cocktail and ingredient the person can see, with recipe rows as the
 * role-masked presentation shows them, so "can make" never needs a spec the
 * person isn't allowed to read. ~11,000 rows (~3 MB), so it's paged and kept
 * in memory only. ponytail: a dozen page reads per load; the upgrade is the
 * SQL "can make" in the schema proposal.
 */
function useCatalog() {
  return useQuery({
    queryKey: ['home-bar-catalog'],
    meta: { persist: false },
    queryFn: async (): Promise<CatalogRow[]> => {
      const ofType = (type: CatalogRow['item_type']) =>
        allRows((from, to) =>
          supabase
            .from('app_item_presentation')
            .select(
              'id, name, item_type, glassware_id, item_images(angle, sort_order, is_generated, images(url)), recipes:app_recipe_presentation!recipe_item_id(display_ingredient_id, parent_ingredient_id, is_optional)'
            )
            .eq('item_type', type)
            .order('name', { ascending: true })
            .order('id')
            .range(from, to)
        );
      const [drinks, ingredients] = await Promise.all([ofType('cocktail'), ofType('ingredient')]);
      return [...drinks, ...ingredients] as unknown as CatalogRow[];
    },
  });
}

function toRows(recipes: CatalogRow['recipes']): RecipeRow[] {
  return (recipes ?? [])
    .filter((r) => r.display_ingredient_id)
    .map((r) => ({ ingredientId: r.display_ingredient_id!, genericId: r.parent_ingredient_id, optional: !!r.is_optional }));
}

/** My Bar: the shelf, what it makes, and what one more bottle would unlock. */
export function useMyBar() {
  const shelf = useShelf();
  const catalog = useCatalog();
  const { data: dropdowns } = useDropdowns();

  return useMemo(() => {
    const glassIcon = new Map<string, string>();
    for (const g of (dropdowns?.glassware ?? []) as { id: string; name: string; icon_key?: string | null }[])
      glassIcon.set(g.id, g.icon_key || g.name);

    const items = new Map<string, BarItem>();
    const drinks: Record<string, RecipeRow[]> = {};
    const houseMade: Record<string, RecipeRow[]> = {};
    for (const c of catalog.data ?? []) {
      items.set(c.id, {
        id: c.id,
        name: c.name,
        type: c.item_type,
        imageUrl: heroPicture(c.item_images)?.url ?? null,
        glass: c.glassware_id ? (glassIcon.get(c.glassware_id) ?? null) : null,
      });
      const rows = toRows(c.recipes);
      if (c.item_type === 'cocktail') drinks[c.id] = rows;
      else if (rows.length) houseMade[c.id] = rows;
    }

    const shelfIds = (shelf.data ?? []).filter((id) => items.has(id));
    const result = canMake({ shelf: shelfIds, drinks, houseMade });
    const pick = (ids: string[]) => ids.map((id) => items.get(id)).filter((i): i is BarItem => !!i);
    return {
      shelf: pick(shelfIds),
      canMake: pick(result.canMake).sort((a, b) => a.name.localeCompare(b.name)),
      oneAway: result.oneAway
        .map((a) => ({ ingredient: items.get(a.ingredientId), drinks: pick(a.drinkIds) }))
        .filter((a): a is { ingredient: BarItem; drinks: BarItem[] } => !!a.ingredient),
      /** Every drink the person can see, by name. */
      drinks: [...items.values()].filter((i) => i.type === 'cocktail'),
      canMakeIds: new Set(result.canMake),
      /** Ingredients that can go on a shelf, for the add sheet. */
      bottles: [...items.values()].filter((i) => i.type === 'ingredient' && !houseMade[i.id]),
      shelfIds: new Set(shelfIds),
      isLoading: shelf.isLoading || catalog.isLoading,
      error: shelf.error ?? catalog.error,
    };
  }, [shelf.data, shelf.isLoading, shelf.error, catalog.data, catalog.isLoading, catalog.error, dropdowns?.glassware]);
}
