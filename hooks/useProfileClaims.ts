// Claims on a profile page: making one, mine, and the moderators' review.
// Split out of hooks/useProfiles.ts, which still re-exports it.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import type { ClaimEvidence, ClaimMethod, PersonClaimMethod } from '@/lib/claimVerification';
import type { ProfileKind } from '@/lib/lineage';
import type { PageVisibility } from '@/lib/pageVisibility';
import { changedProfiles } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

export interface ProfileClaim {
  id: string;
  profile_id: string;
  user_id: string;
  bar_id: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  /** How a bar proves it's theirs; 'note' for a person's claim. */
  method: ClaimMethod;
  /** The six digits for an Instagram bio or a call. */
  code: string | null;
  evidence: ClaimEvidence | null;
  /** A moderator's words when they turn it down. */
  decline_reason: string | null;
  /** Page settings chosen during venue setup while it waits; applied on approval (save_claim_setup). */
  setup: ClaimSetup | null;
}

/** What save_claim_setup keeps on a waiting bar claim. */
// A type, not an interface, so it passes as Json.
export type ClaimSetup = {
  page_visibility?: PageVisibility;
  hours?: Record<string, [string, string][]> | null;
  timezone?: string | null;
  phone?: string | null;
  website?: string | null;
  /** The bar's handle; goes on the page only when the page has none (20261103510000). */
  instagram?: string | null;
};

export const CLAIM_COLUMNS = 'id, profile_id, user_id, bar_id, message, status, created_at, method, code, evidence, decline_reason, setup';

/** The signed-in person's claims on one profile, newest first. */
export function useMyClaims(profileId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['profile-claims', 'mine', profileId, userId],
    enabled: !!profileId && !!userId,
    queryFn: async (): Promise<ProfileClaim[]> => {
      const { data, error } = await supabase
        .from('profile_claims')
        .select(CLAIM_COLUMNS)
        .eq('profile_id', profileId!)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileClaim[];
    },
  });
}

export interface NewClaim {
  profile_id: string;
  /** How a moderator can check it: "I'm Jo, here's my Instagram". */
  message: string;
  /** 'instagram': a code messaged from the page's Instagram. 'note' (default): "Something else". */
  method?: PersonClaimMethod;
  /** The six digits the app showed before sending (lib/claimVerification newClaimCode). */
  code?: string | null;
  /** "<bar> confirms you": the bar page whose Admin checks it, sent as a note (20261113310000). */
  confirm_bar?: string | null;
}

/** A claim of mine on someone's page (a person, not a bar), waiting or approved: the newest, or null. */
export interface MyPersonClaim {
  id: string;
  status: 'pending' | 'approved';
  created_at: string;
  /** When it was approved; null while it waits. */
  reviewed_at: string | null;
  /** The bar page asked to confirm it ("<bar> confirms you"), if any. */
  confirm_bar: string | null;
  profile: { id: string; handle: string; display_name: string };
}

/** Whether I've claimed a person's page yet (find-yourself): the bar page's "See your name?" card, and Setup's "Claim sent". */
export function useMyPersonClaim() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['profile-claims', 'person', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyPersonClaim | null> => {
      const { data, error } = await supabase
        .from('profile_claims')
        .select('id, status, created_at, reviewed_at, evidence, profile:profiles!inner(id, handle, display_name, kind)')
        .eq('user_id', userId!)
        .eq('profile.kind', 'person')
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = (data ?? [])[0] as { id: string; status: 'pending' | 'approved'; created_at: string; reviewed_at: string | null; evidence: { confirm_bar?: string } | null; profile: { id: string; handle: string; display_name: string } } | undefined;
      return row ? { id: row.id, status: row.status, created_at: row.created_at, reviewed_at: row.reviewed_at, confirm_bar: row.evidence?.confirm_bar ?? null, profile: { id: row.profile.id, handle: row.profile.handle, display_name: row.profile.display_name } } : null;
    },
  });
}

/**
 * Asks to take over an unclaimed person's page, with or without a profile of
 * your own (start_person_claim). A moderator approves it; if you have a
 * profile, the page merges into it.
 */
export function useClaimProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (claim: NewClaim): Promise<ProfileClaim> => {
      const method = claim.method ?? 'note';
      const { data, error } = await supabase.rpc('start_person_claim', {
        p_profile_id: claim.profile_id,
        p_method: method,
        p_note: claim.message.trim().slice(0, 1000) || null,
        p_code: method === 'instagram' ? (claim.code ?? null) : null,
        ...(claim.confirm_bar ? { p_confirm_bar: claim.confirm_bar } : {}),
      });
      if (error) throw error;
      return data as ProfileClaim;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-claims'] }),
    // Shown inline by ClaimProfile, not as the global toast.
    onError: () => {},
  });
}

/** What a moderator checks a claim against: the page as it stands. */
export interface ClaimPage {
  id: string;
  kind: ProfileKind;
  handle: string;
  display_name: string;
  website: string | null;
  instagram: string | null;
  social_links: string[] | null;
  locality: string | null;
  city: string | null;
  country_code: string | null;
  is_closed: boolean;
}

export interface ClaimForReview extends ProfileClaim {
  profile: ClaimPage | null;
  bar: { name: string } | null;
  /** The claimant's own person profile, if they have one. */
  claimant: { display_name: string; handle: string } | null;
}

/**
 * Pending claims by other people. Only moderators can read other people's
 * claims (RLS), so for everyone else this is empty.
 */
export function usePendingClaims() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['profile-claims', 'pending', userId],
    enabled: !!userId,
    // A moderation queue: always refetch rather than trust the persisted cache.
    staleTime: 0,
    queryFn: async (): Promise<ClaimForReview[]> => {
      const { data, error } = await supabase
        .from('profile_claims')
        .select(`${CLAIM_COLUMNS}, profile:profiles(id, kind, handle, display_name, website, instagram, social_links, locality, city, country_code, is_closed), bar:bars(name)`)
        .eq('status', 'pending')
        .neq('user_id', userId!)
        .order('created_at')
        .limit(100);
      if (error) throw error;
      const claims = (data ?? []) as Omit<ClaimForReview, 'claimant'>[];
      const userIds = [...new Set(claims.map((c) => c.user_id))];
      const people = userIds.length
        ? await supabase.from('profiles').select('user_id, display_name, handle').in('user_id', userIds)
        : { data: [], error: null };
      if (people.error) throw people.error;
      const byUser = new Map((people.data ?? []).map((p) => [p.user_id as string, { display_name: p.display_name as string, handle: p.handle as string }]));
      return claims.map((c) => ({ ...c, claimant: byUser.get(c.user_id) ?? null }));
    },
  });
}

export interface ClaimReview {
  claimId: string;
  approve: boolean;
  /** For a phone claim: the code the bar read out. */
  code?: string;
  /** For turning one down: what the claimant will see. */
  reason?: string;
}

/** Approves (hands the profile over) or turns down a claim. Moderators only. */
export function useReviewClaim() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ claimId, approve, code, reason }: ClaimReview): Promise<{ id: string } | null> => {
      if (approve) {
        // The profile it went to: the page itself, or the claimant's own one it merged into.
        const { data, error } = await supabase.rpc('approve_profile_claim', { p_claim_id: claimId, p_code: code ?? null });
        if (error) throw error;
        return data as { id: string };
      }
      const { data, error } = await supabase
        .from('profile_claims')
        .update({
          status: 'rejected',
          decline_reason: reason?.trim().slice(0, 300) || null,
          reviewed_by: userId ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claimId)
        .eq('status', 'pending')
        .select('id');
      if (error) throw error;
      // RLS turns a non-moderator's update into a silent no-op; say so.
      if (!data?.length) throw new Error('Only moderators can turn down claims, and only pending ones.');
      return null;
    },
    onSuccess: (profile, { approve }) => {
      qc.invalidateQueries({ queryKey: ['profile-claims'] });
      // An approval claims an unclaimed page, or merges it into the claimant's
      // profile; turning one down changes no page.
      if (approve) qc.invalidateQueries(changedProfiles({ unclaimed: true }));
      if (profile) qc.invalidateQueries(changedProfiles({ id: profile.id }));
    },
    // Shown inline by ClaimsReview, not as the global toast.
    onError: () => {},
  });
}
