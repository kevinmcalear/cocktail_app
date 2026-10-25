import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { readFound, SHELF_KEY, useShelfEdit } from '@/hooks/useHomeBar';
import { barSection } from '@/lib/barSections';
import type { ShoppingRow, ShoppingSource } from '@/lib/shoppingList';
import { supabase } from '@/lib/supabase';
import type { Row } from '@/types/db';

const KEY = ['shopping-list'];
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
      const { error } = await supabase
        .from('shopping_list_items')
        .insert(rows.map((a) => ({ item_id: a.itemId ?? null, name: a.name.trim(), source: a.source, for_item_id: a.forItemId ?? null })));
      // 23505: someone else's tap listed it first (another device).
      if (error && error.code !== '23505') throw error;
      return rows.length;
    },
    onSettled,
  });

  const tick = useMutation({
    mutationFn: async ({ row, got }: { row: ShoppingRow; got: boolean }) => {
      // A running-low bottle is on the shelf already; anything else goes on (or comes back off) with the tick.
      if (row.itemId && row.source !== 'running_low') await (got ? shelf.add : shelf.remove).mutateAsync(row.itemId);
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

  return { add, tick, clear, remove, retag };
}
