import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useKit } from '@/hooks/useKit';
import { supabase } from '@/lib/supabase';
import type { Row } from '@/types/db';

// A venue's tools (bar_kit, supabase/migrations/20261019000000_venue_kit.sql,
// 20261110100000_kit_and_ice.sql): ours by key (lib/techniques/equipment.ts)
// or the venue's own by name. Its team reads them, anyone with Prep changes
// them. The venue's ice is hooks/useVenueIce.ts.

export type KitRow = Row<'bar_kit'> & {
  /** Null when the supplier isn't said, or this person can't see the venue's suppliers. */
  supplier_name: string | null;
};

export const barKitKey = (barId: string | null | undefined) => ['bar-kit', barId] as const;

/** The venue's tools, in the order they were added. */
export function useBarKit(barId: string | null | undefined) {
  return useQuery({
    queryKey: barKitKey(barId),
    enabled: !!barId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<KitRow[]> => {
      const { data, error } = await supabase
        .from('bar_kit')
        .select('*, supplier:suppliers(name)')
        .eq('bar_id', barId!)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map(({ supplier, ...row }) => ({ ...row, supplier_name: supplier?.name ?? null }));
    },
  });
}

/** A tool as the Add sheet saves it. No id adds it; ours has a key, the venue's own only a name. */
export type ToolChange = Pick<KitRow, 'key' | 'name' | 'location' | 'count' | 'source' | 'supplier_id' | 'note'> & { id?: string };

/** Add one of the venue's tools, or change one (by id). */
export function useSaveTool(barId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...tool }: ToolChange) => {
      const { error } = id ? await supabase.from('bar_kit').update(tool).eq('id', id) : await supabase.from('bar_kit').insert({ ...tool, bar_id: barId, kind: 'tool' });
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: barKitKey(barId) }),
  });
}

/** Take a tool off the venue's kit. */
export function useRemoveTool(barId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bar_kit').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: barKitKey(barId) }),
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
    const tools = (venue ?? []).flatMap((r) => (r.key ? [r.key] : []));
    return tools.length ? { label: `${venueName ?? 'the venue'}’s kit`, have: tools } : null;
  }
  return home.length ? { label: 'your kit', have: home } : null;
}
