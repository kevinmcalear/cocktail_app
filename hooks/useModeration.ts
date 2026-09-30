import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import type { ReportReason } from '@/lib/safety';
import { supabase } from '@/lib/supabase';

/** Whether I'm a moderator (a catalog admin). False for everyone else. */
export function useIsModerator() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['am-i-moderator', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('am_i_moderator');
      if (error) throw error;
      return data === true;
    },
  }).data === true;
}

export type QueueKind = 'profile' | 'item' | 'release' | 'comment' | 'ranking';

export interface QueuedReport {
  id: string;
  target_kind: QueueKind;
  reason: ReportReason;
  details: string | null;
  status: 'open' | 'actioned' | 'dismissed';
  resolution: string | null;
  created_at: string;
  reviewed_at: string | null;
  profile_id: string | null;
  item_id: string | null;
  release_id: string | null;
  comment_id: string | null;
  /** NULL when the reported thing has been deleted. */
  target_name: string | null;
  target_detail: string | null;
  /** A moderator has hidden it (for a ranking, the bar's profile). */
  target_hidden: boolean;
}

/** The moderator inbox: open reports oldest first, or closed ones newest first. */
export function useReportQueue(open: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['report-queue', open, user?.id],
    enabled: !!user,
    // A moderation queue: always refetch rather than trust the persisted cache.
    staleTime: 0,
    queryFn: async (): Promise<QueuedReport[]> => {
      const { data, error } = await supabase.rpc('get_report_queue', { p_open: open, p_limit: 100 });
      if (error) throw error;
      return (data ?? []) as QueuedReport[];
    },
  });
}

/** What hiding a report's target means: a ranking hides the bar's profile. */
export function hideTarget(report: Pick<QueuedReport, 'target_kind' | 'profile_id' | 'item_id' | 'release_id'>) {
  switch (report.target_kind) {
    case 'profile':
    case 'ranking':
      return report.profile_id ? { kind: 'profile' as const, id: report.profile_id } : null;
    case 'item':
      return report.item_id ? { kind: 'item' as const, id: report.item_id } : null;
    case 'release':
      return report.release_id ? { kind: 'release' as const, id: report.release_id } : null;
    default:
      return null;
  }
}

/**
 * Closes a report as actioned or dismissed, optionally hiding what it's
 * about first. The resolution is what the reporter is told.
 */
export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ report, status, resolution, hide }: { report: QueuedReport; status: 'actioned' | 'dismissed'; resolution: string; hide: boolean }) => {
      const hiding = hide && !report.target_hidden && !!hideTarget(report);
      // resolve_report hides profiles, drinks and releases in the same
      // transaction; a ranking's bar profile is hidden directly first.
      if (hiding && report.target_kind === 'ranking') {
        const { error } = await supabase.rpc('set_content_hidden', { p_kind: 'profile', p_id: report.profile_id, p_hidden: true });
        if (error) throw error;
      }
      const { error } = await supabase.rpc('resolve_report', {
        p_report_id: report.id,
        p_status: status,
        p_resolution: resolution.trim().slice(0, 1000) || null,
        p_hide: hiding && report.target_kind !== 'ranking',
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-queue'] }),
    onError: () => {},
  });
}

/** Hides or restores a report's target without closing it. */
export function useSetContentHidden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ report, hidden }: { report: QueuedReport; hidden: boolean }) => {
      const target = hideTarget(report);
      if (!target) throw new Error('There is nothing to hide for this report.');
      const { error } = await supabase.rpc('set_content_hidden', { p_kind: target.kind, p_id: target.id, p_hidden: hidden });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-queue'] }),
    onError: () => {},
  });
}
