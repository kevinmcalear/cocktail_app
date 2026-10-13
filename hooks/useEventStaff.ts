import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { viewerScoped } from '@/lib/authCache';
import { guestShiftIds, toStaffRow, withGuestStaff, type EventStaffRow, type StaffRpcRow } from '@/lib/eventStaff';
import { supabase } from '@/lib/supabase';
import type { WeekItem } from '@/lib/week';

/**
 * Behind the bar (20261016500000_event_staff.sql). Everyone reads through
 * week_event_staff, which names only the people whose choices allow it; the
 * bar's team (with the menus permission) writes event_staff. Keys sit under
 * 'week', so saving or deleting an event refreshes them too.
 */

async function readStaff(eventIds: string[]): Promise<EventStaffRow[]> {
  if (!eventIds.length) return [];
  const { data, error } = await supabase.rpc('week_event_staff', { p_event_ids: eventIds });
  if (error) throw error;
  return ((data ?? []) as StaffRpcRow[]).map(toStaffRow);
}

/** The people behind the bar at one event, in order. */
export function useEventStaff(eventId: string | null | undefined) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['week', 'staff', eventId, viewer.key],
    meta: viewer.meta,
    enabled: !!eventId,
    queryFn: () => readStaff([eventId!]),
  });
}

/**
 * A week's guest shifts with their guest bartenders in the line ("Mara Q. from
 * The Lantern Room"). Asks only when the week has a guest shift that could use
 * it. A failure leaves the week as it was: the names are a nicety.
 */
export async function addGuestStaff(items: WeekItem[]): Promise<WeekItem[]> {
  const ids = guestShiftIds(items);
  if (!ids.length) return items;
  try {
    return withGuestStaff(items, await readStaff(ids.slice(0, 100)));
  } catch {
    return items;
  }
}

export type NewStaff = { eventId: string; sortOrder: number } & ({ userId: string } | { guestName: string; profileId: string | null });

export function useAddEventStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: NewStaff) => {
      const row: { event_id: string; sort_order: number; user_id?: string; guest_name?: string; profile_id?: string | null } =
        'userId' in s
          ? { event_id: s.eventId, user_id: s.userId, sort_order: s.sortOrder }
          : { event_id: s.eventId, guest_name: s.guestName.trim(), profile_id: s.profileId, sort_order: s.sortOrder };
      const { error } = await supabase.from('event_staff').insert(row);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week'] }),
  });
}

export function useRemoveEventStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_staff').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week'] }),
  });
}
