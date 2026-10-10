import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useUserId } from '@/ctx/AuthContext';
import { viewerScoped } from '@/lib/authCache';
import { supabase } from '@/lib/supabase';
import { toWeekItem, WEEK_DAYS, weekStart, type EventKind, type WeekItem, type WeekRow } from '@/lib/week';

/**
 * This week (20261012600000_this_week.sql): a bar's week for its team or its
 * guests (bar_week), the week at home (my_week), and one event (week_event).
 * The server decides what each viewer sees; the key carries the viewer so a
 * team's week is never shown signed out.
 */

/** The bar day this screen opened on, so a week read stays one cache entry all evening. */
export function useWeekStart(): Date {
  const [from] = useState(() => weekStart(Date.now()));
  return from;
}

export function useBarWeek(barId: string | null | undefined) {
  const from = useWeekStart();
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['week', 'bar', barId, from.toISOString(), viewer.key],
    meta: viewer.meta,
    enabled: !!barId,
    queryFn: async (): Promise<WeekItem[]> => {
      const { data, error } = await supabase.rpc('bar_week', { p_bar_id: barId, p_from: from.toISOString(), p_days: WEEK_DAYS });
      if (error) throw error;
      return ((data ?? []) as WeekRow[]).map(toWeekItem);
    },
  });
}

/** The bars you love, plus your dated home menus. Signed in only. */
export function useMyWeek() {
  const from = useWeekStart();
  const userId = useUserId();
  return useQuery({
    queryKey: ['week', 'mine', from.toISOString(), userId],
    enabled: !!userId,
    queryFn: async (): Promise<WeekItem[]> => {
      const { data, error } = await supabase.rpc('my_week', { p_from: from.toISOString(), p_days: WEEK_DAYS });
      if (error) throw error;
      return ((data ?? []) as WeekRow[]).map(toWeekItem);
    },
  });
}

export function useWeekEvent(id: string | null | undefined) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['week', 'event', id, viewer.key],
    meta: viewer.meta,
    enabled: !!id,
    queryFn: async (): Promise<WeekItem | null> => {
      const { data, error } = await supabase.rpc('week_event', { p_event_id: id });
      if (error) throw error;
      const row = ((data ?? []) as WeekRow[])[0];
      return row ? toWeekItem(row) : null;
    },
  });
}

/** The team's own copy of an event, for editing: notes and the menu included. */
export interface EventDraft {
  id?: string;
  bar_id: string;
  name: string;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  is_public: boolean;
  house_menu_on: boolean;
  guest_name: string | null;
  description: string | null;
  ticket_url: string | null;
  menu_id: string | null;
}

const DRAFT_COLUMNS = 'id, bar_id, name, kind, starts_at, ends_at, is_public, house_menu_on, guest_name, description, ticket_url, menu_id';

export function useEventDraft(id: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['week', 'draft', id, userId],
    enabled: !!id && !!userId,
    queryFn: async (): Promise<EventDraft | null> => {
      const { data, error } = await supabase.from('events').select(DRAFT_COLUMNS).eq('id', id!).maybeSingle();
      if (error) throw error;
      return (data as EventDraft | null) ?? null;
    },
  });
}

/** Adds or changes an event, then refreshes every week that might show it. */
export function useSaveEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...row }: EventDraft): Promise<string> => {
      const query = id ? supabase.from('events').update(row).eq('id', id) : supabase.from('events').insert(row);
      const { data, error } = await query.select('id').single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week'] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week'] }),
  });
}

