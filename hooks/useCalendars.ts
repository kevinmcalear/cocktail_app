import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';
import type { EventKind } from '@/lib/week';

/**
 * A venue's calendars, part D of This week (20261014100000_calendar_review.sql):
 * its team-only words, and the events its calendars brought in that nobody
 * has looked at yet. Keys sit under 'week' so every week refreshes with them.
 */

/** The words an imported event's name can hold to stay with the team. */
export const DEFAULT_TEAM_WORDS = ['staff', 'team', 'training', 'clean', 'delivery', 'stocktake', 'inventory', 'meeting', 'rota', 'interview'];

export function useTeamWords(barId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['week', 'team-words', barId, userId],
    enabled: !!barId && !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('venue_calendar_settings').select('team_words').eq('bar_id', barId!).maybeSingle();
      if (error) throw error;
      return (data as { team_words: string[] } | null)?.team_words ?? DEFAULT_TEAM_WORDS;
    },
  });
}

export function useSaveTeamWords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ barId, words }: { barId: string; words: string[] }) => {
      const { error } = await supabase.from('venue_calendar_settings').upsert({ bar_id: barId, team_words: words });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week', 'team-words'] }),
  });
}

/** "staff, deep clean,Training" → ['staff', 'deep clean', 'training']. */
export const parseTeamWords = (text: string) => [...new Set(text.split(',').map((w) => w.trim().toLowerCase()).filter((w) => w && w.length <= 40))];

export interface ImportedEvent {
  id: string;
  name: string;
  kind: EventKind;
  starts_at: string;
  is_public: boolean;
  description: string | null;
  /** The guest's bar page, once linked (a guest shift or takeover). */
  guest_profile_id: string | null;
  source_id: string;
  external_uid: string;
  duplicate_of: string | null;
  source: { url: string; starts_public: boolean; skipped_uids: string[] } | null;
  original: { name: string } | null;
}

/** What the venue's calendars brought in that nobody has reviewed, soonest first (from yesterday on). */
export function useNewFromCalendars(barId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['week', 'unreviewed', barId, userId],
    enabled: !!barId && !!userId,
    queryFn: async (): Promise<ImportedEvent[]> => {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { data, error } = await supabase
        .from('events')
        .select('id, name, kind, starts_at, is_public, description, guest_profile_id, source_id, external_uid, duplicate_of, source:calendar_sources(url, starts_public, skipped_uids), original:duplicate_of(name)')
        .eq('bar_id', barId!)
        .is('reviewed_at', null)
        .not('source_id', 'is', null)
        .gte('starts_at', since)
        .order('starts_at')
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ImportedEvent[];
    },
  });
}

/** Done: the ones picked go to Everyone, and everything on the list counts as seen. */
export function useReviewImports() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ share, seen }: { share: string[]; seen: string[] }) => {
      const now = new Date().toISOString();
      if (share.length) {
        const { error } = await supabase.from('events').update({ is_public: true, reviewed_at: now }).in('id', share);
        if (error) throw error;
      }
      const rest = seen.filter((id) => !share.includes(id));
      if (rest.length) {
        const { error } = await supabase.from('events').update({ reviewed_at: now }).in('id', rest);
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week'] }),
  });
}

/** "Link to <bar> so it's credited?": the imported guest shift links the guest's bar page, which credits its drinks. */
export function useLinkImportGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, profileId }: { id: string; profileId: string }) => {
      const { error } = await supabase.from('events').update({ guest_profile_id: profileId, guest_name: null }).eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week'] }),
  });
}

/** Not a duplicate after all: it joins the week as its own event. */
export function useKeepImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').update({ duplicate_of: null }).eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week'] }),
  });
}

/** A duplicate goes for good: the import is deleted and its calendar skips it from now on. */
export function useDropImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: ImportedEvent) => {
      const skipped = [...new Set([...(event.source?.skipped_uids ?? []), event.external_uid])];
      const { error: skipError } = await supabase.from('calendar_sources').update({ skipped_uids: skipped }).eq('id', event.source_id);
      if (skipError) throw skipError;
      const { error } = await supabase.from('events').delete().eq('id', event.id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['week'] }),
  });
}
