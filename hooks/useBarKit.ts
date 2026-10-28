import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useKit } from '@/hooks/useKit';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useMode } from '@/hooks/useMode';
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

/** Add the venue's tools (several in one insert), or change one (by id). */
export function useSaveTool(barId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (changes: ToolChange[]) => {
      const [{ id, ...tool }] = changes;
      const { error } = id
        ? await supabase.from('bar_kit').update(tool).eq('id', id)
        : await supabase.from('bar_kit').insert(changes.map((t) => ({ ...t, bar_id: barId, kind: 'tool' })));
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: barKitKey(barId) }),
  });
}

/** Add our tools by equipment id (an ice recipe's "Add to kit"); ones the venue already has are left as they are. */
export function useAddTools(barId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('bar_kit').upsert(
        ids.map((key) => ({ bar_id: barId, kind: 'tool', key })),
        { onConflict: 'bar_id,kind,key', ignoreDuplicates: true },
      );
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

/**
 * The tools "you have" where you are (Kit and ice, step 11): the venue's in
 * venue mode, your kit at home otherwise. The technique library checks
 * against it; a recipe being made uses useMakingKit.
 */
export function useKitHere(): ReadonlySet<string> {
  const { active } = useActiveVenue();
  const venue = useMode().mode === 'venue' ? active : null;
  const rows = useBarKit(venue?.id ?? null).data;
  const home = useKit().kit;
  return useMemo(() => {
    const ours = (rows ?? []).flatMap((r) => (r.key ? [r.key] : []));
    // A venue with no tools listed (or still loading) isn't checked against: your own kit stands in, as the kit check skips it.
    return venue && ours.length ? new Set(ours) : home;
  }, [venue, rows, home]);
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
  const addTools = useAddTools(bar?.id ?? '');
  if (bar) {
    const canEdit = !!caps?.includes('prep');
    return {
      kit: tools.data ? new Set(tools.data.flatMap((r) => (r.kind === 'tool' && r.key ? [r.key] : []))) : null,
      where: `${bar.name}’s Kit`,
      add: canEdit ? (ids) => addTools.mutate(ids) : null,
      edit: canEdit ? `/settings/bar/${bar.id}/tools` : null,
    };
  }
  return { kit: home.kit, where: 'My Bar', add: (ids) => ids.filter((id) => !home.kit.has(id)).forEach((id) => home.toggle(id)), edit: '/equipment' };
}
