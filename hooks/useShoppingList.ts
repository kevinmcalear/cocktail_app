import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { readFound, SHELF_KEY, useShelfEdit } from '@/hooks/useHomeBar';
import { barSection } from '@/lib/barSections';
import { PANTRY_WATER } from '@/lib/pantry';
import { juiceFruit, type ShoppingRow, type ShoppingSource } from '@/lib/shoppingList';
import { supabase } from '@/lib/supabase';
import type { Row } from '@/types/db';

const KEY = ['shopping-list'];
// ponytail: rows whose tick put the bottle on the shelf, this session only, so Undo never takes off a bottle you
// already had; after a restart an untick leaves the shelf alone. A got_shelved column would make it durable.
const shelvedByTick = new Set<string>();
type Raw = Pick<Row<'shopping_list_items'>, 'id' | 'item_id' | 'name' | 'source' | 'for_item_id' | 'got_at' | 'cleared_at'>;

/** Rows with where each is bought, its picture and the drink it's for, from the catalog. */
async function shoppingRows(raw: Raw[]): Promise<ShoppingRow[]> {
  const itemIds = [...new Set(raw.flatMap((r) => (r.item_id ? [r.item_id] : [])))];
  const forIds = [...new Set(raw.flatMap((r) => (r.for_item_id ? [r.for_item_id] : [])))];
  const [found, drinks] = await Promise.all([
    itemIds.length ? readFound(itemIds) : [],
    forIds.length ? supabase.from('app_item_presentation').select('id, name').in('id', forIds) : { data: [], error: null },
  ]);
  if (drinks.error) throw drinks.error;
  const items = new Map(found.map((f) => [f.id, f]));
  const names = new Map((drinks.data ?? []).map((d) => [d.id as string, d.name as string]));
  return raw.map((r) => {
    const item = r.item_id ? items.get(r.item_id) : undefined;
    return {
      id: r.id,
      itemId: r.item_id,
      name: r.name,
      source: r.source as ShoppingSource,
      forName: (r.for_item_id && names.get(r.for_item_id)) || null,
      section: item?.section ?? barSection({ name: r.name }),
      imageUrl: item?.imageUrl ?? null,
      gotAt: r.got_at,
    };
  });
}

/** What a house-made thing's recipe calls for, optional lines left out. */
async function readMadeFrom(itemId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from('app_recipe_presentation').select('display_ingredient_id, is_optional').eq('recipe_item_id', itemId);
  if (error) throw error;
  const ids = [...new Set((data ?? []).flatMap((r) => (r.display_ingredient_id && !r.is_optional ? [r.display_ingredient_id] : [])))];
  if (!ids.length) return [];
  const names = await supabase.from('app_item_presentation').select('id, name').in('id', ids);
  if (names.error) throw names.error;
  return (names.data ?? []).flatMap((r) => (r.id && r.name ? [{ id: r.id, name: r.name }] : []));
}

/** The list: what's still to get, then what's ticked and not yet cleared (Got it), oldest first. */
const listQuery = {
  queryKey: KEY,
  queryFn: async (): Promise<ShoppingRow[]> => {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('id, item_id, name, source, for_item_id, got_at, cleared_at')
      .is('cleared_at', null)
      .order('added_at')
      .limit(500);
    if (error) throw error;
    return shoppingRows(data ?? []);
  },
};

export function useShoppingList() {
  return useQuery(listQuery);
}

/** Things ticked and cleared before, newest first, one per thing: "Bought before". */
export function useBoughtBefore() {
  return useQuery({
    queryKey: [...KEY, 'before'],
    queryFn: async (): Promise<{ itemId: string; name: string }[]> => {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .select('item_id, name')
        .not('cleared_at', 'is', null)
        .not('item_id', 'is', null)
        .order('cleared_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).flatMap((r) => (r.item_id && !seen.has(r.item_id) && seen.add(r.item_id) ? [{ itemId: r.item_id, name: r.name }] : []));
    },
  });
}

export interface ShoppingAdd {
  itemId?: string | null;
  name: string;
  source: ShoppingSource;
  /** The drink it's for. */
  forItemId?: string | null;
}

/** Add, tick, untick, clear and take off. Ticking a thing you don't have puts it on your shelf in the same tap. */
export function useShoppingEdit() {
  const client = useQueryClient();
  const shelf = useShelfEdit();
  const onSettled = () => client.invalidateQueries({ queryKey: KEY });
  const patch = (change: (rows: ShoppingRow[]) => ShoppingRow[]) => {
    const before = client.getQueryData<ShoppingRow[]>(KEY);
    client.setQueryData<ShoppingRow[]>(KEY, (rows) => change(rows ?? []));
    return { before };
  };
  const onError = (_e: unknown, _v: unknown, ctx?: { before?: ShoppingRow[] }) => client.setQueryData(KEY, ctx?.before);

  // Things already on the open list stay as they are: a bottle is listed once.
  const add = useMutation({
    mutationFn: async (adds: ShoppingAdd[]): Promise<number> => {
      // The open list as the server has it, so one listed bottle can't fail the whole insert.
      const open = await client.ensureQueryData(listQuery);
      const listed = (a: ShoppingAdd) => open.some((r) => (a.itemId ? r.itemId === a.itemId : !r.itemId && r.name.toLowerCase() === a.name.trim().toLowerCase()));
      const rows = adds.filter((a, i) => !listed(a) && adds.findIndex((b) => (a.itemId ? b.itemId === a.itemId : b.name === a.name)) === i);
      if (!rows.length) return 0;
      const insert = (batch: ShoppingAdd[]) =>
        supabase.from('shopping_list_items').insert(batch.map((a) => ({ item_id: a.itemId ?? null, name: a.name.trim(), source: a.source, for_item_id: a.forItemId ?? null })));
      const { error } = await insert(rows);
      if (!error) return rows.length;
      if (error.code !== '23505') throw error;
      // 23505: another device listed one of them first, which fails the whole insert. One at a time, skipping those.
      const one = await Promise.all(rows.map((a) => insert([a])));
      const failed = one.find((r) => r.error && r.error.code !== '23505');
      if (failed?.error) throw failed.error;
      return one.filter((r) => !r.error).length;
    },
    onSettled,
  });

  const tick = useMutation({
    mutationFn: async ({ row, got }: { row: ShoppingRow; got: boolean }) => {
      // A running-low bottle is on the shelf already; anything else goes on with the tick, and comes back off
      // with Undo only when this tick put it there.
      if (row.itemId && row.source !== 'running_low') {
        const had = (client.getQueryData<string[]>(SHELF_KEY) ?? []).includes(row.itemId);
        if (got && !had) {
          await shelf.add.mutateAsync(row.itemId);
          shelvedByTick.add(row.id);
        } else if (!got && shelvedByTick.delete(row.id)) await shelf.remove.mutateAsync(row.itemId);
      }
      const { error } = await supabase.from('shopping_list_items').update({ got_at: got ? new Date().toISOString() : null }).eq('id', row.id);
      if (error) throw error;
    },
    onMutate: ({ row, got }) => patch((rows) => rows.map((r) => (r.id === row.id ? { ...r, gotAt: got ? new Date().toISOString() : null } : r))),
    onError,
    onSettled: () => {
      onSettled();
      client.invalidateQueries({ queryKey: SHELF_KEY });
    },
  });

  /** Got it's rows off the list, kept for Bought before. */
  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('shopping_list_items').update({ cleared_at: new Date().toISOString() }).not('got_at', 'is', null).is('cleared_at', null);
      if (error) throw error;
    },
    onMutate: () => patch((rows) => rows.filter((r) => !r.gotAt)),
    onError,
    onSettled: () => {
      onSettled();
      client.invalidateQueries({ queryKey: [...KEY, 'before'] });
    },
  });

  /** Off the list without buying it. */
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shopping_list_items').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => patch((rows) => rows.filter((r) => r.id !== id)),
    onError,
    onSettled,
  });

  /** Why it's there changes: a running-low bottle finished becomes one to buy again. */
  const retag = useMutation({
    mutationFn: async ({ id, source }: { id: string; source: ShoppingSource }) => {
      const { error } = await supabase.from('shopping_list_items').update({ source }).eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, source }) => patch((rows) => rows.map((r) => (r.id === id ? { ...r, source } : r))),
    onError,
    onSettled,
  });

  /**
   * A house-made thing (shopping In 4, d54): what it's made from goes on the
   * list instead, for it, leaving out what's on the shelf and water. Returns
   * how many went on.
   */
  const addMadeFrom = useMutation({
    mutationFn: async ({ item, onShelf, pantry }: { item: { id: string; name: string }; onShelf: ReadonlySet<string>; pantry: readonly { id: string; name: string }[] }): Promise<number> => {
      // A juice in the recipe is bought as its fruit, as when it's added by hand.
      const parts = (await readMadeFrom(item.id)).map((p) => {
        const fruit = juiceFruit(p.name);
        const id = fruit && pantry.find((x) => x.name.toLowerCase() === fruit.name.toLowerCase())?.id;
        return fruit && id ? { id, name: fruit.label } : p;
      });
      const needed = parts.filter((p, i) => !onShelf.has(p.id) && p.name.toLowerCase() !== PANTRY_WATER.toLowerCase() && parts.findIndex((x) => x.id === p.id) === i);
      return add.mutateAsync(needed.map((p) => ({ itemId: p.id, name: p.name, source: 'hand' as const, forItemId: item.id })));
    },
  });

  return { add, tick, clear, remove, retag, addMadeFrom };
}
