import { useMutation, useQueryClient } from '@tanstack/react-query';

import { changedProfiles, type ClaimSetup, type ProfileClaim } from '@/hooks/useProfiles';
import { track } from '@/lib/analytics';
import type { BarClaimMethod, TypedDetails } from '@/lib/claimVerification';
import { supabase } from '@/lib/supabase';

export interface NewBarClaim {
  profileId: string;
  method: BarClaimMethod;
  /** Link a venue the claimant is Admin of instead of making a new one. */
  barId: string | null;
  /** Their name and role, or when to call. */
  note: string;
  /** The six digits the app showed before sending (lib/claimVerification newClaimCode). */
  code?: string | null;
  /** What they typed where the page has no Instagram, website or phone. Only the chosen way's goes; the page's own wins. */
  typed?: TypedDetails;
}

/**
 * Starts a claim on an unclaimed bar page. A strong email match comes back
 * approved, with a new (or linked) venue; Instagram and phone claims come
 * back pending with their code.
 */
export function useStartBarClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, method, barId, note, code, typed }: NewBarClaim): Promise<ProfileClaim> => {
      const { data, error } = await supabase.rpc('start_bar_claim', {
        p_profile_id: profileId,
        p_method: method,
        p_bar_id: barId,
        p_note: note.trim().slice(0, 1000) || null,
        p_code: method === 'email' ? null : (code ?? null),
        p_instagram: method === 'instagram' ? typed?.instagram?.trim() || null : null,
        p_website: method === 'email' ? typed?.website?.trim() || null : null,
        p_phone: method === 'phone' ? typed?.phone?.trim() || null : null,
      });
      if (error) throw error;
      return data as ProfileClaim;
    },
    onSuccess: (claim, { method }) => {
      track('claim_started', { method, approved: claim.status === 'approved' });
      qc.invalidateQueries({ queryKey: ['profile-claims'] });
      if (claim.status === 'approved') {
        // A new venue, and a page that's now theirs.
        qc.invalidateQueries({ queryKey: ['bars'] });
        qc.invalidateQueries(changedProfiles({ id: claim.profile_id }));
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

/**
 * Keeps page settings (who sees it, hours, phone, website) on the person's own
 * waiting claim. They go onto the page when a moderator approves it; the
 * public page doesn't change before that.
 */
export function useSaveClaimSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ claimId, setup }: { claimId: string; setup: ClaimSetup }): Promise<ProfileClaim> => {
      const { data, error } = await supabase.rpc('save_claim_setup', { p_claim_id: claimId, p_setup: setup });
      if (error) throw error;
      return data as ProfileClaim;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-claims'] }),
    onError: () => {},
  });
}
