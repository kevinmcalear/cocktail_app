import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useKit } from '@/hooks/useKit';
import { useCapabilities } from '@/hooks/useCapabilities';
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
      const rest = (before ?? []).filter((r) => !(r.key && ids.includes(r.key)));
      const now = new Date().toISOString();
      const added = on
        ? ids.map((k): KitRow => ({ id: `new-${k}`, bar_id: barId, kind: 'tool', key: k, name: null, location: null, count: null, source: null, note: null, supplier_id: null, supplier_name: null, sort_order: 0, created_at: now, updated_at: now }))
        : [];
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
    const tools = (venue ?? []).flatMap((r) => (r.key ? [r.key] : []));
    return tools.length ? { label: `${venueName ?? 'the venue'}’s kit`, have: tools } : null;
  }
  return home.length ? { label: 'your kit', have: home } : null;
}

/**
 * The kit a recipe being made is checked against (make-anything-steps-1,
 * step 4, more to it): the Kit of the venue the drink is for, else My Bar's.
 * `kit` is null while the venue's list loads, so nothing dims early. `add`
 * is "I have this": it puts the pieces on that list, and is null for someone
 * who can't change a venue's Kit (it takes Prep); `edit` is where the list
 * is changed, null likewise.
 */
export function useMakingKit(bar: { id: string; name: string } | null): { kit: ReadonlySet<string> | null; where: string; add: ((ids: string[]) => void) | null; edit: string | null } {
  const tools = useBarKit(bar?.id);
  const caps = useCapabilities(bar?.id).data;
  const home = useKit();
  const setTools = useSetTools(bar?.id ?? '');
  if (bar) {
    const canEdit = !!caps?.includes('prep');
    return {
      kit: tools.data ? new Set(tools.data.flatMap((r) => (r.kind === 'tool' && r.key ? [r.key] : []))) : null,
      where: `${bar.name}’s Kit`,
      add: canEdit ? (ids) => setTools.mutate({ ids, on: true }) : null,
      edit: canEdit ? `/settings/bar/${bar.id}/tools` : null,
    };
  }
  return { kit: home.kit, where: 'My Bar', add: (ids) => ids.filter((id) => !home.kit.has(id)).forEach((id) => home.toggle(id)), edit: '/equipment' };
}
