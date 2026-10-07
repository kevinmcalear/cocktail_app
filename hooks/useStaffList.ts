import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { appendRank } from '@/lib/staffList';
import { supabase } from '@/lib/supabase';

export interface StaffPick {
  itemId: string;
  rank: number | null;
  name: string;
  classicName: string | null;
  imageUrl: string | null;
}

export interface BarRiff {
  id: string;
  name: string;
  classicName: string | null;
}

export interface PublicClassic {
  rank: number | null;
  name: string;
  classicName: string | null;
  openId: string | null;
}

/** add: at the end of the ranking. order: the ranked ids, top first; the rest go unranked. */
export type StaffListChange = { op: 'add'; itemId: string } | { op: 'order'; itemIds: string[] } | { op: 'remove'; itemId: string };

interface ItemName {
  id: string;
  name: string;
  riff_of_id: string | null;
  item_images?: ItemImageLink[] | null;
}

async function itemNames(ids: string[], images = false): Promise<Map<string, ItemName>> {
  if (!ids.length) return new Map();
  const columns = images ? 'id, name, riff_of_id, item_images(angle, sort_order, is_generated, images(url))' : 'id, name, riff_of_id';
  const { data, error } = await supabase.from('items').select(columns).in('id', ids);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ItemName[];
  return new Map(rows.map((row) => [row.id, row]));
}

const staffListKey = (barId: string | null | undefined) => ['staff-list', barId] as const;

/** The venue's staff list, for the people who work there. */
export function useStaffList(barId: string | null | undefined) {
  return useQuery({
    queryKey: staffListKey(barId),
    enabled: !!barId,
    queryFn: async (): Promise<StaffPick[]> => {
      const { data, error } = await supabase.from('bar_off_menu').select('item_id, sort_rank').eq('bar_id', barId!);
      if (error) throw error;
      const picks = (data ?? []) as { item_id: string; sort_rank: number | null }[];
      const items = await itemNames(picks.map((p) => p.item_id), true);
      const classics = await itemNames([...items.values()].map((i) => i.riff_of_id).filter((id): id is string => !!id));
      return picks.map((p) => {
        const item = items.get(p.item_id);
        const classic = item?.riff_of_id ? classics.get(item.riff_of_id) : undefined;
        return {
          itemId: p.item_id,
          rank: p.sort_rank,
          name: item?.name ?? 'Drink',
          classicName: classic?.name ?? null,
          imageUrl: heroPicture(item?.item_images)?.url ?? null,
        };
      });
    },
  });
}

/** The venue's own cocktails that are already linked to a classic, to add from. */
export function useBarRiffs(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['staff-list-riffs', barId],
    enabled: !!barId,
    queryFn: async (): Promise<BarRiff[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, riff_of_id')
        .eq('bar_id', barId!)
        .eq('item_type', 'cocktail')
        .not('riff_of_id', 'is', null)
        .order('name');
      if (error) throw error;
      const rows = (data ?? []) as ItemName[];
      const classics = await itemNames(rows.map((r) => r.riff_of_id).filter((id): id is string => !!id));
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        classicName: (r.riff_of_id && classics.get(r.riff_of_id)?.name) || null,
      }));
    },
  });
}

/**
 * Add, reorder, or remove. The database refuses anything that isn't a classic
 * or a riff on one, and anyone without the menus capability. A reorder shows
 * at once and rolls back if the database says no.
 */
export function useStaffListEdit(barId: string | null | undefined) {
  const client = useQueryClient();
  const key = staffListKey(barId);
  const mutationKey = ['staff-list-edit', barId];
  return useMutation({
    mutationKey,
    // One at a time, in the order they were made: quick taps on Move up stay in order.
    scope: { id: `staff-list-${barId}` },
    mutationFn: async (change: StaffListChange) => {
      if (!barId) throw new Error('No venue');
      if (change.op === 'order') {
        const { error } = await supabase.rpc('set_staff_list_order', { p_bar_id: barId, p_item_ids: change.itemIds });
        if (error) throw error;
        return;
      }
      const ranks = (client.getQueryData<StaffPick[]>(key) ?? []).map((p) => p.rank);
      const { error } =
        change.op === 'add'
          ? await supabase.from('bar_off_menu').insert({ bar_id: barId, item_id: change.itemId, sort_rank: appendRank(ranks) })
          : await supabase.from('bar_off_menu').delete().eq('bar_id', barId).eq('item_id', change.itemId);
      if (error) throw error;
    },
    onMutate: async (change) => {
      if (change.op !== 'order') return;
      await client.cancelQueries({ queryKey: key });
      const rank = new Map(change.itemIds.map((id, i) => [id, i + 1]));
      client.setQueryData<StaffPick[]>(key, (rows) => rows?.map((p) => ({ ...p, rank: rank.get(p.itemId) ?? null })));
    },
    onSettled: () => {
      // Refetching while a later change is queued would flash the older order.
      if (client.isMutating({ mutationKey }) > 1) return;
      void client.invalidateQueries({ queryKey: key });
      void client.invalidateQueries({ queryKey: ['bar-classics', barId] });
    },
  });
}

interface PublicRow {
  sort_rank: number | null;
  ask_name: string;
  classic_name: string | null;
  open_id: string | null;
}

/** The same list as a patron sees it on the bar's public page. Works signed out. */
export function usePublicClassics(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['bar-classics', barId],
    enabled: !!barId,
    staleTime: 60_000,
    queryFn: async (): Promise<PublicClassic[]> => {
      const { data, error } = await supabase.rpc('get_bar_classics', { p_bar_id: barId! });
      if (error) throw error;
      return ((data ?? []) as PublicRow[]).map((row) => ({
        rank: row.sort_rank,
        name: row.ask_name,
        classicName: row.classic_name && row.classic_name !== row.ask_name ? row.classic_name : null,
        openId: row.open_id,
      }));
    },
  });
}
