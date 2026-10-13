import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useUserId } from '@/ctx/AuthContext';
import { viewerScoped } from '@/lib/authCache';
import { invokeFunction } from '@/lib/invokeFunction';
import { supabase } from '@/lib/supabase';
import { toWeekItem, WEEK_DAYS, weekStart, withGuestColors, type BarPlace, type EventKind, type WeekItem, type WeekRow } from '@/lib/week';

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
      return withGuestColors(((data ?? []) as WeekRow[]).map(toWeekItem));
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
      return withGuestColors(((data ?? []) as WeekRow[]).map(toWeekItem));
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

/** A drink on an event's menu, as its page lists it. Plain JSON. */
export interface EventDrink {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  glassKey: string | null;
}

/**
 * The drinks on an event's menu (week_event_drinks): every one for the bar's
 * team, the published ones for guests, nothing for an event they can't open.
 */
export function useWeekEventDrinks(id: string | null | undefined, enabled = true) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['week', 'event-drinks', id, viewer.key],
    meta: viewer.meta,
    enabled: !!id && enabled,
    queryFn: async (): Promise<EventDrink[]> => {
      const { data, error } = await supabase.rpc('week_event_drinks', { p_event_id: id });
      if (error) throw error;
      return ((data ?? []) as { id: string; name: string; description: string | null; image_url: string | null; glass_key: string | null }[]).map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        imageUrl: d.image_url,
        glassKey: d.glass_key,
      }));
    },
  });
}

/** Where a bar is, from its public page (readable signed out), for Directions. */
export function useBarPlace(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ['week', 'place', profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<BarPlace | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, address_line, locality, postcode, city, latitude, longitude')
        .eq('id', profileId!)
        .maybeSingle();
      if (error) throw error;
      return (data as BarPlace | null) ?? null;
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
  /** The guest, when it's a bar profile here; guest_name is the free-text fallback. */
  guest_profile_id: string | null;
  guest_name: string | null;
  description: string | null;
  ticket_url: string | null;
  menu_id: string | null;
}

const DRAFT_COLUMNS = 'id, bar_id, name, kind, starts_at, ends_at, is_public, house_menu_on, guest_profile_id, guest_name, description, ticket_url, menu_id';

/** An event as saved, with the calendar it came from (if any): read only, never sent back on save. */
export interface SavedEvent extends EventDraft {
  source: { starts_public: boolean } | null;
}

export function useEventDraft(id: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['week', 'draft', id, userId],
    enabled: !!id && !!userId,
    queryFn: async (): Promise<SavedEvent | null> => {
      const { data, error } = await supabase.from('events').select(`${DRAFT_COLUMNS}, source:calendar_sources(starts_public)`).eq('id', id!).maybeSingle();
      if (error) throw error;
      return (data as SavedEvent | null) ?? null;
    },
  });
}

/** Which of a venue's events came in from a calendar link, for "From your calendar" on the week's cards. */
export function useCalendarEventIds(barId: string | null | undefined) {
  const from = useWeekStart();
  const userId = useUserId();
  return useQuery({
    queryKey: ['week', 'from-calendar', barId, from.toISOString(), userId],
    enabled: !!barId && !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('id')
        .eq('bar_id', barId!)
        .not('source_id', 'is', null)
        .gte('starts_at', new Date(from.getTime() - 86400000).toISOString())
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((r) => (r as { id: string }).id);
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

// --- Calendar links (20261012610000_calendar_sources.sql, the sync-calendar function) ---

export interface CalendarSource {
  id: string;
  url: string;
  starts_public: boolean;
  last_synced_at: string | null;
  last_error: string | null;
}

export interface FoundEvent {
  uid: string;
  name: string;
  starts_at: string;
  ends_at: string | null;
  kind: EventKind;
  /** Looks like a staff thing (or private): left out, or kept with the team. */
  internal: boolean;
  ticket_url: string | null;
}

/** webcal:// is https:// for us. */
export const calendarUrl = (raw: string) => raw.trim().replace(/^webcals?:\/\//i, 'https://');

export function useCalendarSources(barId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['week', 'calendars', barId, userId],
    enabled: !!barId && !!userId,
    queryFn: async (): Promise<CalendarSource[]> => {
      const { data, error } = await supabase
        .from('calendar_sources')
        .select('id, url, starts_public, last_synced_at, last_error')
        .eq('bar_id', barId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as CalendarSource[];
    },
  });
}

/** What a calendar link holds over the next month, nothing saved. */
export function usePreviewCalendar() {
  return useMutation({
    mutationFn: async ({ barId, url }: { barId: string; url: string }) =>
      (await invokeFunction<{ events: FoundEvent[] }>('sync-calendar', { bar_id: barId, url: calendarUrl(url), preview: true })).events,
  });
}

/** Keeps the link and brings its events in now; the server checks it every few hours after that. */
export function useAddCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ barId, url, startsPublic, skipped }: { barId: string; url: string; startsPublic: boolean; skipped: string[] }) => {
      const { data, error } = await supabase
        .from('calendar_sources')
        .insert({ bar_id: barId, url: calendarUrl(url), starts_public: startsPublic, skipped_uids: skipped })
        .select('id')
        .single();
      if (error) throw error;
      return invokeFunction<{ added: number }>('sync-calendar', { source_id: (data as { id: string }).id });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week'] }),
  });
}

/** Stops bringing a calendar in, and takes its events out of the week. */
export function useRemoveCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_sources').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week'] }),
  });
}
