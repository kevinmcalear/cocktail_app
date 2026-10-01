import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface OffMenuPick {
  itemId: string;
  rank: number | null;
  name: string;
  classicName: string | null;
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

export type OffMenuChange =
  | { op: 'add'; itemId: string }
  | { op: 'rank'; itemId: string; rank: number | null }
  | { op: 'remove'; itemId: string };

interface ItemName {
  id: string;
  name: string;
  riff_of_id: string | null;
}

async function itemNames(ids: string[]): Promise<Map<string, ItemName>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase.from('items').select('id, name, riff_of_id').in('id', ids);
  if (error) throw error;
  const rows = (data ?? []) as ItemName[];
  return new Map(rows.map((row) => [row.id, row]));
}

/** The venue's off-menu classics, for the people who work there. */
export function useOffMenu(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['off-menu', barId],
    enabled: !!barId,
    queryFn: async (): Promise<OffMenuPick[]> => {
      const { data, error } = await supabase.from('bar_off_menu').select('item_id, sort_rank').eq('bar_id', barId!);
      if (error) throw error;
      const picks = (data ?? []) as { item_id: string; sort_rank: number | null }[];
      const items = await itemNames(picks.map((p) => p.item_id));
      const classics = await itemNames([...items.values()].map((i) => i.riff_of_id).filter((id): id is string => !!id));
      return picks.map((p) => {
        const item = items.get(p.item_id);
        const classic = item?.riff_of_id ? classics.get(item.riff_of_id) : undefined;
        return {
          itemId: p.item_id,
          rank: p.sort_rank,
          name: item?.name ?? 'Drink',
          classicName: classic?.name ?? null,
        };
      });
    },
  });
}

/** The venue's own cocktails that are already linked to a classic, to add from. */
export function useBarRiffs(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['off-menu-riffs', barId],
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

/** Add, rank, or remove one pick. The database refuses anything that isn't a classic. */
export function useOffMenuEdit(barId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (change: OffMenuChange) => {
      if (!barId) throw new Error('No venue');
      const { error } =
        change.op === 'add'
          ? await supabase.from('bar_off_menu').insert({ bar_id: barId, item_id: change.itemId, sort_rank: null })
          : change.op === 'remove'
            ? await supabase.from('bar_off_menu').delete().eq('bar_id', barId).eq('item_id', change.itemId)
            : await supabase.from('bar_off_menu').update({ sort_rank: change.rank }).eq('bar_id', barId).eq('item_id', change.itemId);
      if (error) throw error;
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['off-menu', barId] });
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
