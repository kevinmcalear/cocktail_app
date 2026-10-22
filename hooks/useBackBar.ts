import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useSwapSource } from '@/hooks/useBulk';
import { useTonight } from '@/hooks/useTonight';
import { ingredientsUsed, waitingForSpot, type NamedItem, type UsedItem } from '@/lib/backBar';
import { showMessage } from '@/lib/dialogs';
import { supabase } from '@/lib/supabase';
import type { BackBarItem, BackBarSource, BarZone, BarZoneKind, ItemLocation } from '@/types/backBar';

const zonesKey = (barId: string | null | undefined) => ['bar-zones', barId];
const locationsKey = (barId: string | null | undefined) => ['item-locations', barId];

const ZONE_COLUMNS = 'id, bar_id, name, kind, description, photo_url, plan_x, plan_y, plan_w, plan_h, sort_order';
const stockKey = (barId: string | null | undefined) => ['back-bar-items', barId];
const STOCK_COLUMNS = 'id, bar_id, item_id, source, from_name, added_at, item:items!item_id(id, name)';
const LOCATION_COLUMNS = 'id, bar_id, item_id, zone_id, shelf, container, photo_url, par_amount, par_unit, sort_order, item:items!item_id(id, name)';

/** The venue's zones (shelves, fridges, speed rail...), in their set order. Needs the `locations` capability. */
export function useBarZones(barId: string | null | undefined) {
  return useQuery({
    queryKey: zonesKey(barId),
    enabled: !!barId,
    queryFn: async (): Promise<BarZone[]> => {
      const { data, error } = await supabase.from('bar_zones').select(ZONE_COLUMNS).eq('bar_id', barId!).order('sort_order').order('name');
      if (error) throw error;
      return (data ?? []) as BarZone[];
    },
  });
}

/** Where every item lives at the venue, with the item's name. */
export function useItemLocations(barId: string | null | undefined) {
  return useQuery({
    queryKey: locationsKey(barId),
    enabled: !!barId,
    queryFn: async (): Promise<ItemLocation[]> => {
      const { data, error } = await supabase.from('item_locations').select(LOCATION_COLUMNS).eq('bar_id', barId!).order('sort_order').order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as ItemLocation[];
    },
  });
}

/** What the venue says it stocks, newest first, with each item's name. Every member reads it. */
export function useBackBarStock(barId: string | null | undefined) {
  return useQuery({
    queryKey: stockKey(barId),
    enabled: !!barId,
    queryFn: async (): Promise<BackBarItem[]> => {
      const { data, error } = await supabase.from('back_bar_items').select(STOCK_COLUMNS).eq('bar_id', barId!).order('added_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BackBarItem[];
    },
  });
}

/** Why a bottle is on the back bar besides the stock list: the bar made it, it has a spot, or a spec pours it. */
export type BackBarReason = 'own' | 'spot' | 'pour';

/**
 * The venue's back bar in two parts: what's on its stock list, and what is
 * there anyway (its own bottles, what has a spot on its map, what its specs
 * already pour). Empty at home (no venue).
 */
export function useBackBarParts(barId: string | null | undefined, catalog: readonly { id: string; bar_id?: string | null }[]) {
  const pours = useSwapSource(barId ?? null);
  const spots = useItemLocations(barId);
  const stock = useBackBarStock(barId);
  return useMemo(() => {
    const fixed = new Map<string, BackBarReason>();
    const stocked = new Set<string>();
    if (!barId) return { fixed, stocked };
    for (const d of pours.data?.drinks ?? []) for (const l of d.lines) if (l.ingredientId) fixed.set(l.ingredientId, 'pour');
    for (const s of spots.data ?? []) fixed.set(s.item_id, 'spot');
    for (const i of catalog) if (i.bar_id === barId) fixed.set(i.id, 'own');
    for (const s of stock.data ?? []) stocked.add(s.item_id);
    return { fixed, stocked };
  }, [barId, pours.data, spots.data, stock.data, catalog]);
}

/** The venue's back bar as item ids: its stock list and everything that's there anyway. */
export function useBackBarIds(barId: string | null | undefined, catalog: readonly { id: string; bar_id?: string | null }[]): Set<string> {
  const { fixed, stocked } = useBackBarParts(barId, catalog);
  return useMemo(() => new Set([...fixed.keys(), ...stocked]), [fixed, stocked]);
}

interface RecipeRow {
  recipe_item_id: string;
  display_ingredient: NamedItem | null;
}

// Specs rarely nest deeper than a syrup inside a batch inside a drink.
const MAX_LEVELS = 4;

/**
 * Ingredients used by the venue's current menus, walking down through
 * house-made ones. Recipes come from the presentation view, masked by role
 * like every recipe read.
 */
function useMenuIngredients(barId: string | null | undefined) {
  const { drinks, isLoading: menusLoading } = useTonight(barId ?? null);
  // Menu order, so the waiting list reads like the menu; sorted only for the cache key.
  const drinkIds = useMemo(() => [...new Set(drinks.map((d) => d.id))], [drinks]);
  const query = useQuery({
    // Named apart from the older cache entry, whose rows had no `drinks`.
    queryKey: ['menu-ingredients-by-drink', barId, [...drinkIds].sort()],
    enabled: !!barId && drinkIds.length > 0,
    queryFn: async (): Promise<UsedItem[]> => {
      const recipeOf: Record<string, NamedItem[]> = {};
      const fetched = new Set<string>();
      let frontier = drinkIds;
      for (let level = 0; level < MAX_LEVELS && frontier.length; level++) {
        const { data, error } = await supabase
          .from('app_recipe_presentation')
          .select('recipe_item_id, display_ingredient(id, name)')
          .in('recipe_item_id', frontier)
          .order('sort_order');
        if (error) throw error;
        frontier.forEach((id) => fetched.add(id));
        const next: string[] = [];
        for (const row of (data ?? []) as unknown as RecipeRow[]) {
          if (!row.display_ingredient) continue;
          (recipeOf[row.recipe_item_id] ??= []).push({ id: row.display_ingredient.id, name: row.display_ingredient.name });
          if (!fetched.has(row.display_ingredient.id)) next.push(row.display_ingredient.id);
        }
        frontier = [...new Set(next)];
      }
      return ingredientsUsed(drinkIds, recipeOf);
    },
  });
  return { data: query.data ?? [], drinks, isLoading: menusLoading || query.isLoading, error: query.error };
}

/** What has no place at the venue yet: bottles put on the back bar, then what the current menus pour. */
export function useWaitingForSpot(barId: string | null | undefined) {
  const used = useMenuIngredients(barId);
  const locations = useItemLocations(barId);
  const stock = useBackBarStock(barId);
  const [now] = useState(() => Date.now());
  const waiting = useMemo(() => {
    const names = new Map(used.drinks.map((d) => [d.id, d.name]));
    return waitingForSpot(stock.data ?? [], used.data, locations.data ?? [], (id) => names.get(id), now);
  }, [stock.data, used.data, used.drinks, locations.data, now]);
  return { waiting, isLoading: used.isLoading || locations.isLoading || stock.isLoading };
}

/**
 * Put a bottle on the back bar's stock list, or take it off. Create and edit
 * drinks, or Prep list and orders (the same people who place items). The
 * list changes in the cache straight away, so the line's bottle lights at
 * once; a failed write puts it back.
 */
export function useStockMutations(barId: string | null | undefined) {
  const qc = useQueryClient();
  const key = stockKey(barId);
  const before = async () => {
    await qc.cancelQueries({ queryKey: key });
    return { before: qc.getQueryData<BackBarItem[]>(key) };
  };
  const rollback = (error: Error, _v: unknown, ctx?: { before?: BackBarItem[] }) => {
    qc.setQueryData(key, ctx?.before);
    onWriteError(error);
  };
  // A tap and its Undo save one after the other, in order (a delete must not
  // pass the insert it undoes), and the list is read again after the last.
  const queue = { mutationKey: ['stock-write', barId], scope: { id: `stock-write-${barId}` } };
  const refresh = () => {
    if (qc.isMutating({ mutationKey: queue.mutationKey }) <= 1) void qc.invalidateQueries({ queryKey: key });
  };

  const add = useMutation({
    ...queue,
    mutationFn: async ({ item, source, fromName }: { item: NamedItem; source: BackBarSource; fromName?: string | null }) => {
      const { error } = await supabase.from('back_bar_items').insert({ bar_id: barId!, item_id: item.id, source, from_name: fromName?.trim().slice(0, 200) || null });
      // Already on the list (another tap, another person): that's what was asked for.
      if (error && error.code !== '23505') throw error;
    },
    onMutate: async ({ item, source, fromName }) => {
      const ctx = await before();
      const row: BackBarItem = { id: `pending-${item.id}`, bar_id: barId!, item_id: item.id, source, from_name: fromName ?? null, added_at: new Date().toISOString(), item };
      qc.setQueryData<BackBarItem[]>(key, (rows) => [row, ...(rows ?? []).filter((r) => r.item_id !== item.id)]);
      return ctx;
    },
    onError: rollback,
    onSettled: refresh,
  });

  const remove = useMutation({
    ...queue,
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('back_bar_items').delete().eq('bar_id', barId!).eq('item_id', itemId);
      if (error) throw error;
    },
    onMutate: async (itemId) => {
      const ctx = await before();
      qc.setQueryData<BackBarItem[]>(key, (rows) => rows?.filter((r) => r.item_id !== itemId));
      return ctx;
    },
    onError: rollback,
    onSettled: refresh,
  });

  return { add, remove };
}

function onWriteError(error: Error) {
  // 23505: a unique index, here a zone name the venue already uses.
  if ((error as Error & { code?: string }).code === '23505') {
    showMessage('That name is taken', 'Another zone here already has that name. Pick a different one.');
    return;
  }
  showMessage('That didn’t save', `${error.message}. Check your connection and try again.`);
}

export interface ZoneChanges {
  name?: string;
  kind?: BarZoneKind;
  description?: string | null;
  plan_x?: number;
  plan_y?: number;
  plan_w?: number;
  plan_h?: number;
}

/** Draw the plan: add a zone, rename or describe it, move it. Drink Creators and up. */
export function useZoneMutations(barId: string | null | undefined) {
  const qc = useQueryClient();
  const key = zonesKey(barId);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const addZone = useMutation({
    mutationFn: async (zone: Required<Pick<ZoneChanges, 'name' | 'kind' | 'plan_x' | 'plan_y' | 'plan_w' | 'plan_h'>>) => {
      const sort = (qc.getQueryData<BarZone[]>(key)?.length ?? 0) + 1;
      const { data, error } = await supabase.from('bar_zones').insert({ ...zone, bar_id: barId!, sort_order: sort }).select(ZONE_COLUMNS).single();
      if (error) throw error;
      return data as BarZone;
    },
    onError: onWriteError,
    onSettled: refresh,
  });

  // Changes land in the cache straight away and save one at a time, in order,
  // so quick arrow presses all count. The refetch waits for the last save.
  const saveZone = useMutation({
    mutationKey: ['zone-write', barId],
    scope: { id: `zone-write-${barId}` },
    mutationFn: async ({ id, changes }: { id: string; changes: ZoneChanges }) => {
      const { error } = await supabase.from('bar_zones').update(changes).eq('id', id).eq('bar_id', barId!);
      if (error) throw error;
    },
    onError: onWriteError,
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ['zone-write', barId] }) <= 1) void refresh();
    },
  });

  const updateZone = (id: string, changes: ZoneChanges | ((zone: BarZone) => ZoneChanges)) => {
    void qc.cancelQueries({ queryKey: key });
    const zone = qc.getQueryData<BarZone[]>(key)?.find((z) => z.id === id);
    if (!zone) return;
    const next = typeof changes === 'function' ? changes(zone) : changes;
    qc.setQueryData<BarZone[]>(key, (zones) => zones?.map((z) => (z.id === id ? { ...z, ...next } : z)));
    saveZone.mutate({ id, changes: next });
  };

  return { addZone, updateZone, isSavingZone: saveZone.isPending };
}

export interface LocationChanges {
  zone_id?: string;
  shelf?: string | null;
  container?: string | null;
  par_amount?: number | null;
  par_unit?: string | null;
}

/** Place, move and remove items. Drink Creators and up, and roles with `prep`. */
export function useLocationMutations(barId: string | null | undefined) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: locationsKey(barId) });

  const placeItem = useMutation({
    mutationFn: async ({ itemId, zoneId }: { itemId: string; zoneId: string }) => {
      // Goes to the end of the zone's list.
      const inZone = qc.getQueryData<ItemLocation[]>(locationsKey(barId))?.filter((l) => l.zone_id === zoneId) ?? [];
      const sort = Math.max(0, ...inZone.map((l) => l.sort_order)) + 1;
      const { error } = await supabase.from('item_locations').insert({ bar_id: barId!, item_id: itemId, zone_id: zoneId, sort_order: sort });
      if (error) throw error;
    },
    onError: onWriteError,
    onSettled: refresh,
  });

  const updateLocation = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: LocationChanges }) => {
      const { error } = await supabase.from('item_locations').update(changes).eq('id', id).eq('bar_id', barId!);
      if (error) throw error;
    },
    onError: onWriteError,
    onSettled: refresh,
  });

  const removeLocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('item_locations').delete().eq('id', id).eq('bar_id', barId!);
      if (error) throw error;
    },
    onError: onWriteError,
    onSettled: refresh,
  });

  return { placeItem, updateLocation, removeLocation };
}
