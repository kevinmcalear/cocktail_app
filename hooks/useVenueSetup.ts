import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { CLAIM_COLUMNS, type ProfileClaim } from '@/hooks/useProfiles';
import { supabase } from '@/lib/supabase';

/** A bar page on the Find your bar step, with what the card shows. */
export interface ClaimableBar {
  id: string;
  handle: string;
  display_name: string;
  address_line: string | null;
  locality: string | null;
  city: string | null;
  bar_type: string | null;
  avatar_url: string | null;
  /** Someone runs it already: a venue or a person has it. */
  claimed: boolean;
  is_closed: boolean;
  awards: number;
  drinks: number;
  /** Up to three of its drinks, for their drawings. */
  sample: { id: string; name: string }[];
}

type Row = Omit<ClaimableBar, 'claimed' | 'awards' | 'drinks'> & {
  is_claimed: boolean;
  bar_id: string | null;
  awards: { count: number }[] | null;
  drinks: { count: number }[] | null;
};

/** Bar pages by name for setup's search, claimed ones too (they show dimmed). */
export function useClaimableBars(search: string) {
  const term = search.replace(/[%_\\,()]/g, '').trim();
  return useQuery({
    queryKey: ['claimable-bars', term],
    enabled: term.length >= 2,
    queryFn: async (): Promise<ClaimableBar[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, handle, display_name, address_line, locality, city, bar_type, avatar_url, is_claimed, bar_id, is_closed, awards:profile_awards!profile_awards_profile_id_fkey(count), drinks:items!items_origin_bar_profile_id_fkey(count), sample:items!items_origin_bar_profile_id_fkey(id, name)'
        )
        .eq('kind', 'bar')
        .eq('is_public', true)
        .ilike('display_name', `%${term}%`)
        .order('display_name')
        .limit(3, { referencedTable: 'sample' })
        .limit(6);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map(({ is_claimed, bar_id, awards, drinks, ...b }) => ({
        ...b,
        claimed: is_claimed || !!bar_id,
        awards: awards?.[0]?.count ?? 0,
        drinks: drinks?.[0]?.count ?? 0,
      }));
    },
  });
}

/** How many bar pages there are: "2 of 1,375 bar pages". */
export function useBarPageCount() {
  return useQuery({
    queryKey: ['bar-page-count'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('kind', 'bar').eq('is_public', true);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** My newest claim that names this venue: waiting, approved or turned down. */
export function useVenueClaim(barId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['profile-claims', 'venue', barId, userId],
    enabled: !!barId && !!userId,
    staleTime: 0,
    queryFn: async (): Promise<ProfileClaim | null> => {
      const { data, error } = await supabase
        .from('profile_claims')
        .select(CLAIM_COLUMNS)
        .eq('bar_id', barId!)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as ProfileClaim | null) ?? null;
    },
  });
}

/** The venue's own bar page, once a claim has linked it (null before), with where it is (New menu's season names). */
export function useVenuePage(barId: string | null) {
  return useQuery({
    queryKey: ['venue-page', barId],
    enabled: !!barId,
    queryFn: async (): Promise<{ id: string; handle: string; latitude?: number | null; timezone?: string | null } | null> => {
      const { data, error } = await supabase.from('profiles').select('id, handle, latitude, timezone').eq('bar_id', barId!).eq('kind', 'bar').maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/**
 * The venue setup works on: a private venue with the person as its Admin
 * (create_new_bar, as Settings always allowed). The claim then links it to
 * the bar page once a person approves it.
 */
export function useCreateSetupVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<string> => {
      const { data, error } = await supabase.rpc('create_new_bar', {
        p_name: name.trim(),
        p_visibility: 10,
        p_generic: 20,
        p_specific: 30,
        p_measurement: 30,
        p_prep: 40,
      });
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bars'] }),
    onError: () => {},
  });
}
