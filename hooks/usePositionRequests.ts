import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';

/** A job someone listed at a bar, waiting on the bar's yes (position_requests). */
export interface PositionRequest {
  id: string;
  title: string;
  is_current: boolean;
  created_at: string;
  /** The bar's venue on Cocktail; null for a bar with none (moderators answer those). */
  venue_id: string | null;
  bar_profile_id: string;
  bar_name: string;
  person_profile_id: string;
  person_handle: string;
  person_name: string;
  person_avatar_url: string | null;
  person_is_public: boolean;
}

/**
 * Jobs waiting on the signed-in person's yes as a bar: at venues they're a
 * current Admin of, and, for moderators, at bars with no venue. Everyone else
 * gets an empty list.
 */
export function usePositionRequests(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['position-requests', user?.id],
    enabled: !!user && enabled,
    // A queue: refetch rather than trust the persisted cache.
    staleTime: 0,
    queryFn: async (): Promise<PositionRequest[]> => {
      const { data, error } = await supabase.rpc('position_requests');
      if (error) throw error;
      return (data ?? []) as PositionRequest[];
    },
  });
}

/** Yes or no to a job, from whichever side is waiting on the caller. No removes it. */
export function useAnswerPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = accept
        ? await supabase.rpc('accept_profile_position', { p_id: id })
        : await supabase.rpc('decline_profile_position', { p_id: id });
      if (error) throw new Error(error.code === 'P0001' ? error.message : "Couldn't save that. Check your connection and try again.");
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['position-requests'] });
      await qc.invalidateQueries({ queryKey: ['profile-positions'] });
    },
    // Shown inline next to the buttons, not as the global toast.
    onError: () => {},
  });
}

/** Whether both the person and the bar have said yes, so everyone can see it. */
export const isConfirmedPosition = (p: { person_accepted: boolean; bar_accepted: boolean }) => p.person_accepted && p.bar_accepted;
