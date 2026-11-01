import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import type { BarMember } from '@/hooks/useBarDetail';
import { useShifts } from '@/hooks/useRota';
import { useTonight } from '@/hooks/useTonight';
import type { RoleMatrixRow } from '@/hooks/useVenueRoles';
import { supabase } from '@/lib/supabase';
import { serviceEnd } from '@/lib/tonight';
import { SHOWN_CREDITS } from '@/lib/whoMadeIt';

const DAY = 86_400_000;
const hourStart = (t: number) => t - (t % 3_600_000);

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
      // Credits name a person page; theirs is the one their account claimed.
      // ponytail: profiles RLS hides a page that isn't public, so a private page reads as no credits. Most new staff have no page at all, and 0 is true for them. Upgrade path: a read scoped to the bar's own team (Kevin's, a new definer function).
      const person = await supabase.from('profiles').select('id').eq('user_id', userId!).eq('kind', 'person').limit(1).maybeSingle();
      if (person.error) throw person.error;
      if (!person.data) return [];
      const { data, error } = await supabase
        .from('item_credits')
        .select('item_id, items!inner(bar_id)')
        .eq('profile_id', person.data.id)
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
