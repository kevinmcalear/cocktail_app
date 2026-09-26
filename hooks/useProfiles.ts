import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { LINEAGE_COLUMNS } from '@/hooks/useLineage';
import type { ItemImageLink } from '@/lib/itemImages';
import type { LineageDrink } from '@/lib/lineage';
import { groupMenuCredits, parseProfileRef, type MenuCredit, type MenuDrinkRow } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  kind: 'person' | 'bar';
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  locality: string | null;
  city: string | null;
  country_code: string | null;
  /** Owner. Both null: unclaimed (a historic creator, a bar not on the app). */
  user_id: string | null;
  bar_id: string | null;
  is_public: boolean;
}

const COLUMNS = 'id, kind, handle, display_name, bio, avatar_url, website, locality, city, country_code, user_id, bar_id, is_public';

export const isUnclaimed = (p: Pick<Profile, 'user_id' | 'bar_id'>) => !p.user_id && !p.bar_id;

/** A profile by id or handle (a /p/<ref> link). Public ones for anyone; private ones for their owner. */
export function useProfile(ref: string | string[] | null | undefined) {
  const parsed = parseProfileRef(ref);
  return useQuery({
    queryKey: ['profile', parsed],
    enabled: !!parsed,
    queryFn: async (): Promise<Profile | null> => {
      const query = supabase.from('profiles').select(COLUMNS);
      const { data, error } = await ('id' in parsed! ? query.eq('id', parsed.id) : query.eq('handle', parsed!.handle)).maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
  });
}

export interface Original extends LineageDrink {
  item_type: string;
  glass: { icon_key: string | null } | null;
  item_images: ItemImageLink[] | null;
}

/** Drinks credited to a profile: made by the person, or first made at the bar. */
export function useProfileOriginals(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-originals', profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<Original[]> => {
      const { data, error } = await supabase
        .from('items')
        .select(`${LINEAGE_COLUMNS}, item_type, glass:glassware_id(icon_key), item_images(sort_order, is_generated, outdated_since, images(url))`)
        .or(`creator_profile_id.eq.${profileId},origin_bar_profile_id.eq.${profileId}`)
        .order('name')
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Original[];
    },
  });
}

export interface MenuCreditWithProfile extends MenuCredit {
  /** The bar's public profile, to link to, when it has one. */
  barProfileId: string | null;
}

/**
 * Where these drinks are on bar menus: the credit that matters most.
 * ponytail: menus are readable by the bar's own members only, so a visitor
 * sees the menus of bars they work at. Showing every bar needs a public
 * "on the menu at" read from the publishing piece (7d).
 */
export function useMenuCredits(itemIds: string[]) {
  return useQuery({
    queryKey: ['menu-credits', itemIds],
    enabled: itemIds.length > 0,
    queryFn: async (): Promise<MenuCreditWithProfile[]> => {
      const { data, error } = await supabase
        .from('menu_drinks')
        .select('item_id, menu:menus(id, name, is_active, bar_id, bar:bars(name))')
        .in('item_id', itemIds);
      if (error) throw error;
      const credits = groupMenuCredits((data ?? []) as unknown as MenuDrinkRow[]);
      const barIds = [...new Set(credits.map((c) => c.barId).filter((id): id is string => !!id))];
      const profiles = barIds.length ? await supabase.from('profiles').select('id, bar_id').in('bar_id', barIds) : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const byBar = new Map((profiles.data ?? []).map((p) => [p.bar_id as string, p.id as string]));
      return credits.map((c) => ({ ...c, barProfileId: (c.barId && byBar.get(c.barId)) || null }));
    },
  });
}

// --- Claims ---

export interface ProfileClaim {
  id: string;
  profile_id: string;
  user_id: string;
  bar_id: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const CLAIM_COLUMNS = 'id, profile_id, user_id, bar_id, message, status, created_at';

/** The signed-in person's claims on one profile, newest first. */
export function useMyClaims(profileId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile-claims', 'mine', profileId, user?.id],
    enabled: !!profileId && !!user,
    queryFn: async (): Promise<ProfileClaim[]> => {
      const { data, error } = await supabase
        .from('profile_claims')
        .select(CLAIM_COLUMNS)
        .eq('profile_id', profileId!)
        .eq('user_id', user!.id)
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
  /** Claiming a bar's profile on behalf of this venue. */
  bar_id: string | null;
}

/** Asks to take over an unclaimed profile. A moderator approves it. */
export function useClaimProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (claim: NewClaim): Promise<ProfileClaim> => {
      const message = claim.message.trim().slice(0, 1000) || null;
      const { data, error } = await supabase
        .from('profile_claims')
        .insert({ profile_id: claim.profile_id, message, bar_id: claim.bar_id })
        .select(CLAIM_COLUMNS)
        .single();
      if (error) throw error;
      return data as ProfileClaim;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-claims'] }),
    // Shown inline by ClaimProfile, not as the global toast.
    onError: () => {},
  });
}

export interface ClaimForReview extends ProfileClaim {
  profile: { id: string; kind: 'person' | 'bar'; handle: string; display_name: string } | null;
  bar: { name: string } | null;
  /** The claimant's own person profile, if they have one. */
  claimant: { display_name: string; handle: string } | null;
}

/**
 * Pending claims by other people. Only moderators can read other people's
 * claims (RLS), so for everyone else this is empty.
 */
export function usePendingClaims() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile-claims', 'pending', user?.id],
    enabled: !!user,
    // A moderation queue: always refetch rather than trust the persisted cache.
    staleTime: 0,
    queryFn: async (): Promise<ClaimForReview[]> => {
      const { data, error } = await supabase
        .from('profile_claims')
        .select(`${CLAIM_COLUMNS}, profile:profiles(id, kind, handle, display_name), bar:bars(name)`)
        .eq('status', 'pending')
        .neq('user_id', user!.id)
        .order('created_at')
        .limit(100);
      if (error) throw error;
      const claims = (data ?? []) as unknown as Omit<ClaimForReview, 'claimant'>[];
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

/** Approves (hands the profile over) or turns down a claim. Moderators only. */
export function useReviewClaim() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ claimId, approve }: { claimId: string; approve: boolean }) => {
      if (approve) {
        const { error } = await supabase.rpc('approve_profile_claim', { p_claim_id: claimId });
        if (error) throw error;
        return;
      }
      const { data, error } = await supabase
        .from('profile_claims')
        .update({ status: 'rejected', reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
        .eq('id', claimId)
        .eq('status', 'pending')
        .select('id');
      if (error) throw error;
      // RLS turns a non-moderator's update into a silent no-op; say so.
      if (!data?.length) throw new Error('Only moderators can turn down claims, and only pending ones.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile-claims'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    // Shown inline by ClaimsReview, not as the global toast.
    onError: () => {},
  });
}
