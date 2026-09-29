import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { reportErrorMessage, reportRow, type ReportKind, type ReportReason, type ReportStatus, type ReportTarget } from '@/lib/safety';
import { supabase } from '@/lib/supabase';

// --- Blocks ---

export interface BlockedPerson {
  blocked_id: string;
  /** Their public profile, while it is one. */
  profile_id: string | null;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  blocked_at: string;
}

/** Everyone I've blocked, newest first (get_my_blocks: their profile is hidden from me). */
export function useMyBlocks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-blocks', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<BlockedPerson[]> => {
      const { data, error } = await supabase.rpc('get_my_blocks');
      if (error) throw error;
      return (data ?? []) as BlockedPerson[];
    },
  });
}

/**
 * The account behind a person's profile, to block. Readable signed in only,
 * and only while I can see the profile.
 */
export function useProfileUserId(profileId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile-user-id', profileId, user?.id],
    enabled: !!profileId && !!user,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('profiles').select('user_id').eq('id', profileId!).maybeSingle();
      if (error) throw error;
      return (data?.user_id as string | null | undefined) ?? null;
    },
  });
}

/**
 * Blocks or unblocks a person. A block hides each person's profile, drinks
 * and rankings from the other, so everything already loaded is refetched.
 */
export function useSetBlocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      const { error } = blocked
        ? await supabase.from('user_blocks').insert({ blocked_id: userId })
        : await supabase.from('user_blocks').delete().eq('blocked_id', userId);
      // Blocking twice is still blocked.
      if (error && error.code !== '23505') throw error;
    },
    // Reset, not invalidate: a query whose refetch now fails (the other
    // person's drink) would otherwise keep showing its cached copy.
    // ponytail: drops every cached query rather than tracking which ones
    // carry people's content. Blocking is rare; narrow this if it shows up.
    onSuccess: () => qc.resetQueries(),
    onError: () => {},
  });
}

// --- Reports ---

/** Filter for the target's columns, as the one-open-report index sees them. */
function targetColumns(target: ReportTarget) {
  return {
    profile_id: target.kind === 'profile' || target.kind === 'ranking' ? target.profileId : null,
    item_id: target.kind === 'item' || target.kind === 'ranking' ? target.itemId : null,
    release_id: target.kind === 'release' ? target.releaseId : null,
  };
}

export interface MyReport {
  id: string;
  target_kind: ReportKind | 'comment';
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  /** The moderator's note, once it's closed. */
  resolution: string | null;
  created_at: string;
  reviewed_at: string | null;
  item_id: string | null;
  /** Names I can still read; null once hidden or deleted. */
  profile: { display_name: string } | null;
  item: { name: string } | null;
  release: { name: string } | null;
}

/** Reports I've sent, newest first, with what happened to each. */
export function useMyReports() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-reports', user?.id],
    enabled: !!user,
    staleTime: 0,
    queryFn: async (): Promise<MyReport[]> => {
      const { data, error } = await supabase
        .from('reports')
        .select('id, target_kind, reason, details, status, resolution, created_at, reviewed_at, item_id, profile:profiles(display_name), item:items(name), release:releases(name)')
        .eq('reporter_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const reports = (data ?? []) as unknown as MyReport[];
      // A bar's published drink isn't readable through items outside the
      // bar, so its name comes from the public projection.
      const missing = [...new Set(reports.filter((r) => !r.item && r.target_kind !== 'profile').map((r) => r.item_id).filter((id): id is string => !!id))];
      if (!missing.length) return reports;
      const published = await supabase.from('published_items').select('id, name').in('id', missing);
      if (published.error) throw published.error;
      const names = new Map((published.data ?? []).map((p) => [p.id as string, p.name as string]));
      return reports.map((r) => (!r.item && r.item_id && names.has(r.item_id) ? { ...r, item: { name: names.get(r.item_id)! } } : r));
    },
  });
}

/** My open report on this target, if I've already filed one. */
export function useMyOpenReport(target: ReportTarget | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-open-report', target, user?.id],
    enabled: !!target && !!user,
    staleTime: 0,
    queryFn: async (): Promise<{ id: string; created_at: string } | null> => {
      let query = supabase.from('reports').select('id, created_at').eq('reporter_id', user!.id).eq('status', 'open').eq('target_kind', target!.kind);
      for (const [column, value] of Object.entries(targetColumns(target!))) {
        query = value ? query.eq(column, value) : query.is(column, null);
      }
      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Files a report. Errors come back as words (the daily limit, a repeat). */
export function useFileReport() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ target, reason, details }: { target: ReportTarget; reason: ReportReason; details: string }) => {
      const { error } = await supabase.from('reports').insert(reportRow(target, reason, details));
      if (!error) return;
      let today: number | null = null;
      if (error.code === '42501' && user) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase.from('reports').select('id', { count: 'exact', head: true }).eq('reporter_id', user.id).gt('created_at', since);
        today = count;
      }
      throw new Error(reportErrorMessage(error, today));
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['my-open-report'] }), qc.invalidateQueries({ queryKey: ['my-reports'] })]),
    onError: () => {},
  });
}
