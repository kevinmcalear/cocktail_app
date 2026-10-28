import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { pickerResult, usePickerTerm } from '@/hooks/useDiscover';
import { CLAIM_COLUMNS, changedProfiles, type ProfileClaim } from '@/hooks/useProfiles';
import { withNear, type MaybeNear } from '@/hooks/useSearchNear';
import { supabase } from '@/lib/supabase';
import type { HeldSetup } from '@/store/useVenueSetup';

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


/** Bar pages by name or street for setup's search, claimed ones too (they show dimmed). */
export function useClaimableBars(search: string) {
  const { term, waiting } = usePickerTerm(search.replace(/[%_\\,()]/g, '').trim());
  // Close names too ("lanturn room": The Lantern Room), marked `near`.
  const close = !!useUserId();
  const query = useQuery({
    queryKey: ['claimable-bars', term, close],
    enabled: !!term,
    placeholderData: term ? keepPreviousData : undefined,
    queryFn: async ({ signal }): Promise<MaybeNear<ClaimableBar>[]> => {
      const read = async (ids?: string[]): Promise<ClaimableBar[]> => {
        const q = supabase
          .from('profiles')
          .select(
            'id, handle, display_name, address_line, locality, city, bar_type, avatar_url, is_claimed, bar_id, is_closed, awards:profile_awards!profile_awards_profile_id_fkey(count), drinks:items!items_origin_bar_profile_id_fkey(count), sample:items!items_origin_bar_profile_id_fkey(id, name)'
          )
          .eq('kind', 'bar')
          .eq('is_public', true)
          .limit(3, { referencedTable: 'sample' });
        // By name or street; the term is stripped of the filter syntax's commas and brackets above.
        const byTerm = () => q.or(`display_name.ilike.%${term}%,address_line.ilike.%${term}%`).order('display_name').limit(6);
        const { data, error } = await (ids ? q.in('id', ids) : byTerm()).abortSignal(signal);
        if (error) throw error;
        return (data ?? []).map(({ is_claimed, bar_id, awards, drinks, ...b }) => ({
          ...b,
          claimed: is_claimed || !!bar_id,
          awards: awards?.[0]?.count ?? 0,
          drinks: drinks?.[0]?.count ?? 0,
        }));
      };
      return close ? withNear(term, 'bar', read(), read, signal) : read();
    },
  });
  return pickerResult(query, waiting);
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

/**
 * What setup held before the claim (store/useVenueSetup), put where it goes
 * once the claim is sent: kept on the waiting claim (save_claim_setup), the
 * way step 3 keeps edits while a claim waits, or straight
 * onto the page when the claim came back approved. A detail the claim itself
 * brought (typed into its card) wins over the held one.
 */
export function usePushHeldSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ claim, held }: { claim: ProfileClaim; held: HeldSetup }) => {
      const setup = { ...held };
      const typed = claim.evidence?.typed ?? {};
      if (typed.website) delete setup.website;
      if (typed.phone) delete setup.phone;
      if (claim.status === 'pending') {
        if (!Object.keys(setup).length) return;
        const { error } = await supabase.rpc('save_claim_setup', { p_claim_id: claim.id, p_setup: setup });
        if (error) throw error;
        return;
      }
      if (claim.status !== 'approved') return;
      const { page_visibility, ...page } = setup;
      if (Object.keys(page).length) {
        const { data, error } = await supabase.from('profiles').update(page).eq('id', claim.profile_id).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('You can’t edit this bar’s details yet.');
      }
      if (page_visibility && claim.bar_id) {
        const { data, error } = await supabase.from('bars').update({ page_visibility }).eq('id', claim.bar_id).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('You can’t change who sees this page yet.');
      }
    },
    onSuccess: (_data, { claim }) => {
      qc.invalidateQueries({ queryKey: ['profile-claims'] });
      qc.invalidateQueries({ queryKey: ['bar-facts', claim.profile_id] });
      qc.invalidateQueries({ queryKey: ['bar-publishing'] });
      qc.invalidateQueries(changedProfiles({ id: claim.profile_id }));
    },
    // Shown inline on the claim step.
    onError: () => {},
  });
}
