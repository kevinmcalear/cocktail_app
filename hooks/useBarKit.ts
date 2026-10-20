import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useKit } from '@/hooks/useKit';
import { supabase } from '@/lib/supabase';

// A venue's ice and tools (bar_kit, supabase/migrations/20261019000000_venue_kit.sql):
// its team reads them, anyone with Prep changes them. Row shapes are written
// by hand until types/ is regenerated.

export interface KitRow {
  id: string;
  kind: 'ice' | 'tool';
  key: string;
  note: string | null;
  made_here: boolean;
  supplier_id: string | null;
  /** Null when the supplier isn't said, or this person can't see the venue's suppliers. */
  supplier_name: string | null;
  /** Ice: how long a piece is (a spear), in mm (20261029500000_ice_builds). */
  length_mm?: number | null;
}

export type KitChange = Pick<KitRow, 'kind' | 'key'> & Partial<Pick<KitRow, 'id' | 'note' | 'made_here' | 'supplier_id' | 'length_mm'>>;

export const barKitKey = (barId: string | null | undefined) => ['bar-kit', barId] as const;

/** The venue's ice and tools, in the order they were added. */
export function useBarKit(barId: string | null | undefined) {
  return useQuery({
    queryKey: barKitKey(barId),
    enabled: !!barId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<KitRow[]> => {
      const { data, error } = await supabase
        .from('bar_kit')
        // Every column (length_mm since 20261029500000), so a database without it still answers.
        .select('*, supplier:suppliers(name)')
        .eq('bar_id', barId!)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      type Row = Omit<KitRow, 'supplier_name'> & { supplier: { name: string } | null };
      return ((data ?? []) as unknown as Row[]).map(({ supplier, ...row }) => ({ ...row, supplier_name: supplier?.name ?? null }));
    },
  });
}

/** Add a kit row, or change one (by id). */
export function useSaveKit(barId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...row }: KitChange) => {
      const { error } = id
        ? await supabase
            .from('bar_kit')
            // length_mm only when it's said (spears), so other rows save on a database without it.
            .update({ note: row.note ?? null, made_here: !!row.made_here, supplier_id: row.supplier_id ?? null, ...(row.length_mm !== undefined ? { length_mm: row.length_mm } : {}) })
            .eq('id', id)
        : await supabase.from('bar_kit').insert({ bar_id: barId, ...row });
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: barKitKey(barId) }),
  });
}

/** Take a row off the venue's kit. */
export function useRemoveKit(barId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bar_kit').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: barKitKey(barId) }),
  });
}

/** A tool's switch: on adds it, off takes it away. The list follows at once and goes back if the save fails. */
export function useSetTools(barId: string) {
  const client = useQueryClient();
  const key = barKitKey(barId);
  return useMutation({
    mutationFn: async ({ ids, on }: { ids: string[]; on: boolean }) => {
      const { error } = on
        ? await supabase.from('bar_kit').upsert(ids.map((k) => ({ bar_id: barId, kind: 'tool', key: k })), { onConflict: 'bar_id,kind,key', ignoreDuplicates: true })
        : await supabase.from('bar_kit').delete().eq('bar_id', barId).eq('kind', 'tool').in('key', ids);
      if (error) throw error;
    },
    onMutate: async ({ ids, on }) => {
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData<KitRow[]>(key);
      const rest = (before ?? []).filter((r) => !(r.kind === 'tool' && ids.includes(r.key)));
      const added = on ? ids.map((k): KitRow => ({ id: `new-${k}`, kind: 'tool', key: k, note: null, made_here: false, supplier_id: null, supplier_name: null })) : [];
      client.setQueryData<KitRow[]>(key, [...rest, ...added]);
      return { before };
    },
    onError: (_e, _v, ctx) => client.setQueryData(key, ctx?.before),
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}

/**
 * The tools to check a prep against: a venue's (by id) or, with none, your
 * own kit at home. Null while there's nothing listed, so an empty kit
 * doesn't mark every tool as missing.
 */
export function useToolsFor(barId: string | null, venueName: string | null): { label: string; have: string[] } | null {
  const venue = useBarKit(barId).data;
  const home = useKit().owned;
  if (barId) {
    const tools = (venue ?? []).filter((r) => r.kind === 'tool').map((r) => r.key);
    return tools.length ? { label: `${venueName ?? 'the venue'}’s kit`, have: tools } : null;
  }
  return home.length ? { label: 'your kit', have: home } : null;
}
