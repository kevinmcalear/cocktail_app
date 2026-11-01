import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { buildPrepList, DEFAULT_SERVES, tonightAt6, type HouseMade, type Purchasing, type SpecLine } from '@/lib/prep';
import type { Quantity } from '@/lib/quantity';
import { parByItem, withBatches, type OnHandRow, type ParQuantity } from '@/lib/stock';
import { supabase } from '@/lib/supabase';

export interface RecipeRow {
  recipe_item_id: string;
  amount: number | null;
  unit: string | null;
  display_ingredient_id: string | null;
  display_ingredient: { id: string; name: string } | null;
  part: number | null;
}

interface MenuItem {
  id: string;
  name: string;
  item_type: string;
  ice: { ice_per_serve_g: number | null; ice_id: string | null } | null;
}

export interface PrepData {
  drinks: { id: string; name: string; recipe: SpecLine[] }[];
  /** From the last stock count and the back bar map's pars (empty below the locations capability). */
  onHand: Record<string, Quantity>;
  par: Record<string, ParQuantity>;
  houseMade: Record<string, HouseMade>;
  purchasing: Record<string, Purchasing>;
}

const MAX_LEVELS = 3;

export function toLines(rows: RecipeRow[], recipeId: string): SpecLine[] {
  return rows
    .filter((r) => r.recipe_item_id === recipeId && r.display_ingredient_id && r.display_ingredient)
    .map((r) => ({ ingredientId: r.display_ingredient!.id, name: r.display_ingredient!.name, amount: r.amount, unit: r.unit, part: r.part ?? 1 }));
}

export async function recipesFor(ids: string[]): Promise<RecipeRow[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('app_recipe_presentation')
    .select('recipe_item_id, amount, unit, part, display_ingredient_id, display_ingredient(id, name)')
    .in('recipe_item_id', ids)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as RecipeRow[];
}

/**
 * Walks down from some ingredients: any with its own recipe or prep row is
 * house-made (its recipe, yield, lead time and shelf life, a few levels
 * deep); the rest are leaves, bought as they are.
 */
export async function houseMadeUnder(ingredientIds: string[], skip: Set<string> = new Set()): Promise<{ houseMade: Record<string, HouseMade>; leaves: string[] }> {
  const houseMade: Record<string, HouseMade> = {};
  const seen = new Set<string>(skip);
  let frontier = [...new Set(ingredientIds)];
  const leaves = new Set<string>();
  for (let level = 0; level < MAX_LEVELS && frontier.length; level++) {
    const ids = frontier.filter((id) => !seen.has(id));
    ids.forEach((id) => seen.add(id));
    if (!ids.length) break;
    const [subRecipes, prepRes] = await Promise.all([
      recipesFor(ids),
      supabase.from('item_prep').select('item_id, yield_amount, yield_unit, lead_time_minutes, lead_time_note, shelf_life_hours').in('item_id', ids),
    ]);
    if (prepRes.error) throw prepRes.error;
    const prepById = new Map((prepRes.data ?? []).map((p) => [p.item_id as string, p]));
    const next: string[] = [];
    for (const id of ids) {
      const recipe = toLines(subRecipes, id);
      const prep = prepById.get(id);
      if (!recipe.length && !prep) {
        leaves.add(id);
        continue;
      }
      houseMade[id] = {
        recipe,
        yieldAmount: prep?.yield_amount ?? null,
        yieldUnit: prep?.yield_unit ?? null,
        leadTimeMinutes: prep?.lead_time_minutes ?? null,
        leadTimeNote: prep?.lead_time_note ?? null,
        shelfLifeHours: prep?.shelf_life_hours ?? null,
      };
      next.push(...recipe.map((l) => l.ingredientId));
    }
    frontier = next;
  }
  frontier.forEach((id) => !houseMade[id] && !skip.has(id) && leaves.add(id));
  return { houseMade, leaves: [...leaves] };
}

/** How the bar buys some items: supplier and pack size ("700 ml"). */
export async function purchasingFor(barId: string, itemIds: string[]): Promise<Record<string, Purchasing>> {
  const purchasing: Record<string, Purchasing> = {};
  if (!itemIds.length) return purchasing;
  const [buyRes, supplierRes] = await Promise.all([
    supabase.from('item_purchasing').select('item_id, supplier_id, pack_size_amount, pack_size_unit').eq('bar_id', barId).in('item_id', itemIds),
    supabase.from('suppliers').select('id, name').eq('bar_id', barId),
  ]);
  // ponytail: without the prep or costs capability these reads come back
  // empty (RLS), and the order list just has no packs or suppliers.
  const suppliers = new Map((supplierRes.data ?? []).map((s) => [s.id as string, s.name as string]));
  for (const row of buyRes.data ?? []) {
    purchasing[row.item_id as string] = {
      supplierName: row.supplier_id ? (suppliers.get(row.supplier_id as string) ?? null) : null,
      packAmount: row.pack_size_amount as number | null,
      packUnit: row.pack_size_unit as string | null,
    };
  }
  return purchasing;
}

/**
 * Everything the prep list needs for a set of menus at a venue: each drink's
 * spec, the house-made ingredients under it (their own recipes, yield and lead
 * time, a few levels deep), and how the bar buys the rest. Masked by role on
 * the server like every recipe read.
 */
export function usePrepData(barId: string | null | undefined, menuIds: string[]) {
  const key = [...menuIds].sort();
  return useQuery({
    queryKey: ['prep-data', barId, key],
    enabled: !!barId && key.length > 0,
    queryFn: async (): Promise<PrepData> => {
      const { data: menuRows, error: menuError } = await supabase
        .from('menu_drinks')
        .select('item:items!item_id(id, name, item_type, ice:drink_ice!drink_ice_item_id_fkey(ice_per_serve_g, ice_id))')
        .in('menu_id', key);
      if (menuError) throw menuError;
      const drinkItems = new Map<string, MenuItem>();
      for (const row of (menuRows ?? []) as { item: MenuItem | null }[]) {
        if (row.item?.item_type === 'cocktail') drinkItems.set(row.item.id, row.item);
      }
      const drinkIds = [...drinkItems.keys()];
      const iceIds = [...new Set([...drinkItems.values()].map((i) => i.ice?.ice_id).filter((id): id is string => !!id))];
      const [drinkRecipes, iceRes] = await Promise.all([
        recipesFor(drinkIds),
        iceIds.length ? supabase.from('app_item_presentation').select('id, name').in('id', iceIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (iceRes.error) throw iceRes.error;
      const iceNames = new Map(((iceRes.data ?? []) as { id: string; name: string }[]).map((i) => [i.id, i.name]));
      const drinks = drinkIds.map((id) => {
        const item = drinkItems.get(id)!;
        const iceId = item.ice?.ice_id;
        return { id, name: item.name, recipe: toLines(drinkRecipes, id), iceType: iceId ? (iceNames.get(iceId) ?? null) : null, icePerServeG: item.ice?.ice_per_serve_g ?? null };
      });

      const { houseMade, leaves } = await houseMadeUnder(drinks.flatMap((d) => d.recipe.map((l) => l.ingredientId)), new Set(drinkIds));
      const purchasing = await purchasingFor(barId!, leaves);
      // The shelf: the last count at each spot, and par per item. Both come
      // back empty below the locations capability (RLS), and the list then
      // assumes the bar starts from zero, as before.
      // Batches logged since each count add to it (batch_logs; the last two weeks, like useBatchLogs).
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
      const [stockRes, parRes, batchRes] = await Promise.all([
        supabase.rpc('stock_on_hand', { p_bar: barId! }),
        supabase.from('item_locations').select('item_id, par_amount, par_unit, item:items!item_id(name)').eq('bar_id', barId!),
        supabase.from('batch_logs').select('id, item_id, amount, unit, made_at, made_by').eq('bar_id', barId!).gte('made_at', since),
      ]);
      const batches = (batchRes.data ?? []).map((r) => ({ id: r.id, itemId: r.item_id, amount: Number(r.amount), unit: r.unit, madeAt: r.made_at, madeBy: r.made_by }));
      const onHand = withBatches((stockRes.data ?? []) as OnHandRow[], batches);
      const par = parByItem((parRes.data ?? []) as { item_id: string; par_amount: number | null; par_unit: string | null; item: { name: string } | null }[]);
      return { drinks, houseMade, purchasing, onHand, par };
    },
  });
}

/**
 * A menu's house-made for the bartender's row on its page (Menu-page): how
 * many, and which are low (counted, and under what the list needs tonight).
 * Null until it loads, or with no bar.
 */
export function useMenuHouseMade(barId: string | null, menuId: string): { count: number; low: string[] } | null {
  const data = usePrepData(barId, [menuId]).data;
  return useMemo(() => {
    if (!data) return null;
    const make = buildPrepList({ ...data, servesPerDrink: DEFAULT_SERVES, startsAt: tonightAt6(), now: new Date() }).make;
    return { count: Object.keys(data.houseMade).length, low: make.filter((l) => l.have).map((l) => l.name) };
  }, [data]);
}
