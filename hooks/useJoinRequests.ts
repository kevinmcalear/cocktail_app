import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Row } from '@/types/db';

/** Someone asking to join a venue's team, as its team managers see them (join_requests). */
export interface JoinRequest {
  id: string;
  created_at: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  /** Their person page, when they have one. */
  profile_handle: string | null;
}

const wordy = (error: { code?: string; message: string }) =>
  // The RPCs' own refusals are written for people.
  error.code === 'P0001' || error.code === '42501' ? error.message : "Couldn't send that. Check your connection and try again.";

/** The signed-in person's request to join a venue (bars.id), if they've asked. */
export function useMyJoinRequest(barId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['join-request', userId, barId ?? null],
    enabled: !!userId && !!barId,
    queryFn: async (): Promise<Row<'venue_join_requests'> | null> => {
      const { data, error } = await supabase.from('venue_join_requests').select('*').eq('user_id', userId!).eq('bar_id', barId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** "Ask to join Pale Moth's team" (find-yourself step 6), from the bar's page id. */
export function useAskToJoin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (barProfileId: string) => {
      const { error } = await supabase.rpc('request_to_join_venue', { p_bar_profile_id: barProfileId });
      if (error) throw new Error(wordy(error));
    },
    // Either way: "already on this team" means their venues are out of date too.
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ['join-request'] });
      await qc.invalidateQueries({ queryKey: ['bars'] });
    },
    // Shown inline under the button, not as the global toast.
    onError: () => {},
  });
}

/** Who is asking to join a venue the signed-in person manages the team of. */
export function useJoinRequests(barId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['join-requests', barId],
    enabled,
    // A queue: refetch rather than trust the persisted cache.
    staleTime: 0,
    queryFn: async (): Promise<JoinRequest[]> => {
      const { data, error } = await supabase.rpc('join_requests', { p_bar_id: barId });
      if (error) throw error;
      return (data ?? []) as JoinRequest[];
    },
  });
}

/** Yes (a Bartender on the team) or no to someone asking to join. */
export function useAnswerJoinRequest(barId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase.rpc('answer_join_request', { p_id: id, p_accept: accept });
      if (error) throw new Error(wordy(error));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['join-requests', barId] });
      await qc.invalidateQueries({ queryKey: ['bar-members', barId] });
    },
    onError: () => {},
  });
}
