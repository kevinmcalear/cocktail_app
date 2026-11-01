import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import type { BarMember } from '@/hooks/useBarDetail';
import { useShifts } from '@/hooks/useRota';
import { useTonight } from '@/hooks/useTonight';
import { useVenueProfileId, type RoleMatrixRow } from '@/hooks/useVenueRoles';
import { supabase } from '@/lib/supabase';
import { serviceEnd } from '@/lib/tonight';
import { SHOWN_CREDITS } from '@/lib/whoMadeIt';

const DAY = 86_400_000;
const hourStart = (t: number) => t - (t % 3_600_000);

/** A person's page, the one their account claimed: what credits and jobs name. Null when they have none (or it's private). */
async function personPageId(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('id').eq('user_id', userId).eq('kind', 'person').limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** Who's on the rota between now and the end of tonight's service: "on shift tonight" on Team (Kept-team). */
export function useOnShiftTonight(barId: string | null): ReadonlySet<string> {
  // Read once, so a render never sees the clock move; on the hour, so opening Team again reuses the query.
  const [range] = useState(() => {
    const from = new Date(hourStart(Date.now()));
    return { from: from.toISOString(), to: serviceEnd(from).toISOString() };
  });
  const shifts = useShifts(barId, range.from, range.to).data;
  return useMemo(() => new Set((shifts ?? []).map((s) => s.user_id)), [shifts]);
}

/**
 * Whether a teammate's role manages the team (the staff permission), from
 * the role matrix: a venue role's own column, else their built-in role's.
 */
export function managesTeam(matrix: readonly RoleMatrixRow[], m: Pick<BarMember, 'role_level' | 'venue_role_id'>): boolean {
  const column = m.venue_role_id ? matrix.find((c) => c.role_id === m.venue_role_id) : matrix.find((c) => c.role_id === null && c.base_level === m.role_level);
  return !!column?.capabilities.includes('staff');
}

/** A teammate's page stats (Kept-team, A person): drinks credited to them here, how many are on the list on now, and their next shift. */
export interface MemberStats {
  credited: number;
  /** The first list on now ("Autumn") and how many of their drinks are on it; null with nothing on. */
  onList: { name: string; count: number } | null;
  /** When their next shift starts, within the next four weeks. */
  nextShift: string | null;
  loading: boolean;
  failed: boolean;
}

export function useMemberStats(barId: string, userId: string | null): MemberStats {
  const [range] = useState(() => {
    const from = hourStart(Date.now());
    return { now: Date.now(), from: new Date(from).toISOString(), to: new Date(from + 28 * DAY).toISOString() };
  });
  const shifts = useShifts(userId ? barId : null, range.from, range.to);
  const { menus } = useTonight(userId ? barId : null);
  const credited = useQuery({
    queryKey: ['member-credits', barId, userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      // ponytail: profiles RLS hides a page that isn't public, so a private page reads as no credits. Most new staff have no page at all, and 0 is true for them. Upgrade path: a read scoped to the bar's own team (Kevin's, a new definer function).
      const person = await personPageId(userId!);
      if (!person) return [];
      const { data, error } = await supabase
        .from('item_credits')
        .select('item_id, items!inner(bar_id)')
        .eq('profile_id', person)
        .in('role', ['creator', 'co_creator'])
        .in('status', SHOWN_CREDITS)
        .eq('items.bar_id', barId)
        .limit(500);
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.item_id))];
    },
  });
  const ids = credited.data ?? [];
  const list = menus[0];
  return {
    credited: ids.length,
    onList: list ? { name: list.name, count: list.itemIds.filter((id) => ids.includes(id)).length } : null,
    nextShift: (shifts.data ?? []).find((s) => s.user_id === userId && Date.parse(s.ends_at) > range.now)?.starts_at ?? null,
    loading: shifts.isLoading || credited.isLoading,
    failed: shifts.isError || credited.isError,
  };
}

/**
 * A teammate's job on the venue's bar page ("Bartender at Little Rye"), which
 * shows under Who makes the drinks (Kept-team, A person: "Shows on <bar>'s
 * page"). Null when they have no job there or no page we can read.
 */
export function useMemberPosition(barId: string, userId: string) {
  const venuePage = useVenueProfileId(barId).data;
  return useQuery({
    queryKey: ['member-position', barId, userId],
    enabled: !!venuePage,
    queryFn: async (): Promise<{ id: string; is_hidden: boolean } | null> => {
      const person = await personPageId(userId);
      if (!person) return null;
      const { data, error } = await supabase
        .from('profile_positions')
        .select('id, is_hidden')
        .eq('bar_profile_id', venuePage!)
        .eq('person_profile_id', person)
        .order('is_current', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Shows or hides that job (is_hidden). The bar's side may, with the publish permission (profile_positions_update). */
export function useSetPositionShown(barId: string, userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, shown }: { id: string; shown: boolean }) => {
      const { data, error } = await supabase.from('profile_positions').update({ is_hidden: !shown }).eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('You can’t change what the bar’s page shows.');
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['member-position', barId, userId] });
      await client.invalidateQueries({ queryKey: ['profile-positions'] });
    },
    onError: () => {},
  });
}
