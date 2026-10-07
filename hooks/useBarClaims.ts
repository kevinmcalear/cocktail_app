import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ProfileClaim } from '@/hooks/useProfiles';
import type { BarClaimMethod } from '@/lib/claimVerification';
import { supabase } from '@/lib/supabase';

export interface NewBarClaim {
  profileId: string;
  method: BarClaimMethod;
  /** Link a venue the claimant is Admin of instead of making a new one. */
  barId: string | null;
  /** Their name and role, or when to call. */
  note: string;
}

/**
 * Starts a claim on an unclaimed bar page. A strong email match comes back
 * approved, with a new (or linked) venue; Instagram and phone claims come
 * back pending with their code.
 */
export function useStartBarClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, method, barId, note }: NewBarClaim): Promise<ProfileClaim> => {
      const { data, error } = await supabase.rpc('start_bar_claim', {
        p_profile_id: profileId,
        p_method: method,
        p_bar_id: barId,
        p_note: note.trim().slice(0, 1000) || null,
      });
      if (error) throw error;
      return data as ProfileClaim;
    },
    onSuccess: (claim) => {
      qc.invalidateQueries({ queryKey: ['profile-claims'] });
      if (claim.status === 'approved') {
        // A new venue, and a page that's now theirs.
        qc.invalidateQueries({ queryKey: ['bars'] });
        qc.invalidateQueries({ queryKey: ['profile'] });
      }
    },
    // Shown inline on the claim screen, not as the global toast.
    onError: () => {},
  });
}

/** Withdraws the signed-in person's own pending claim. */
export function useWithdrawClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (claimId: string) => {
      const { data, error } = await supabase.from('profile_claims').delete().eq('id', claimId).eq('status', 'pending').select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('That claim has already been checked, so it can’t be withdrawn.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-claims'] }),
    onError: () => {},
  });
}
