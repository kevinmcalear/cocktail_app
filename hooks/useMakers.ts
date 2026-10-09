import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { originalsByIds, type Original } from '@/hooks/useProfiles';
import { supabase } from '@/lib/supabase';

export interface MakerBottle {
  id: string;
  name: string;
  abv: number | null;
  kind: string | null;
}

interface BottleRow {
  id: string;
  name: string;
  abv: number | null;
  generic: { name: string } | null;
}

// Bottles and drinks are signed-in reads, like the items themselves.

/** The bottles (and other products) that name this maker. */
export function useMakerBottles(profileId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['maker-bottles', profileId, userId],
    enabled: !!profileId && !!userId,
    queryFn: async (): Promise<MakerBottle[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, abv, generic:generic_id(name)')
        .eq('item_type', 'ingredient')
        .eq('maker_profile_id', profileId!)
        .order('name')
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as unknown as BottleRow[]).map((r) => ({ id: r.id, name: r.name, abv: r.abv, kind: r.generic?.name ?? null }));
    },
  });
}

/** Drinks whose ice or glass the maker made, once its team has confirmed the credit. */
export function useMakerDrinks(profileId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['maker-drinks', profileId, userId],
    enabled: !!profileId && !!userId,
    queryFn: async (): Promise<Original[]> => {
      const { data, error } = await supabase
        .from('item_maker_credits')
        .select('item_id')
        .eq('profile_id', profileId!)
        .not('confirmed_at', 'is', null)
        .limit(100);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.item_id as string))];
      return ids.length ? originalsByIds(ids) : [];
    },
  });
}

export interface MakerRef {
  id: string;
  handle: string;
  display_name: string;
  kind?: string;
}

const MAKER_REF = 'id, handle, display_name, kind';

/** Makers by name, for a picker: optionally only those that make `makes` ("ice", "glassware", "bottles"). */
export function useMakerSearch(term: string, makes?: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ['maker-search', q, makes ?? null],
    enabled: q.length >= 2,
    queryFn: async (): Promise<MakerRef[]> => {
      let query = supabase.from('profiles').select(MAKER_REF).eq('kind', 'maker').ilike('display_name', `%${q.replace(/[\\%_]/g, '\\$&')}%`);
      if (makes) query = query.contains('makes', [makes]);
      const { data, error } = await query.order('display_name').limit(8);
      if (error) throw error;
      return (data ?? []) as MakerRef[];
    },
  });
}

/** Who makes a bottle (its maker page), or null. */
export function useItemMaker(itemId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['item-maker', itemId, userId],
    enabled: !!itemId && !!userId,
    queryFn: async (): Promise<MakerRef | null> => {
      const { data, error } = await supabase
        .from('items')
        .select(`maker:profiles!items_maker_profile_id_fkey(${MAKER_REF})`)
        .eq('id', itemId!)
        .maybeSingle();
      if (error) throw error;
      return ((data as { maker: MakerRef | null } | null)?.maker ?? null) as MakerRef | null;
    },
  });
}

/** Set or clear a bottle's maker. The item's own rules decide who may. */
export function useSetItemMaker(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (makerId: string | null) => {
      const { error } = await supabase.from('items').update({ maker_profile_id: makerId }).eq('id', itemId);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['item-maker', itemId] });
      qc.invalidateQueries({ queryKey: ['maker-bottles'] });
    },
  });
}

export interface MakerCredit {
  profile_id: string;
  makes: 'ice' | 'glassware';
  confirmed_at: string | null;
  maker: MakerRef | null;
}

/** Who cut a drink's ice or made its glass, confirmed or not. */
export function useDrinkMakerCredits(itemId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['drink-maker-credits', itemId, userId],
    enabled: !!itemId && !!userId,
    queryFn: async (): Promise<MakerCredit[]> => {
      const { data, error } = await supabase
        .from('item_maker_credits')
        .select(`profile_id, makes, confirmed_at, maker:profiles(${MAKER_REF})`)
        .eq('item_id', itemId!);
      if (error) throw error;
      return (data ?? []) as unknown as MakerCredit[];
    },
  });
}

/** Credit a maker (or the drink's own bar, for its own ice) on a drink; or take a credit off. */
export function useEditMakerCredit(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, makes, remove }: { profileId: string; makes: 'ice' | 'glassware'; remove?: boolean }) => {
      const { error } = remove
        ? await supabase.from('item_maker_credits').delete().eq('item_id', itemId).eq('profile_id', profileId).eq('makes', makes)
        : await supabase.from('item_maker_credits').insert({ item_id: itemId, profile_id: profileId, makes });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['drink-maker-credits', itemId] });
      qc.invalidateQueries({ queryKey: ['maker-drinks'] });
    },
  });
}

/** The drink's own bar page (for "we cut our own ice"), or null for a home drink. */
export function useDrinkBarPage(itemId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['drink-bar-page', itemId, userId],
    enabled: !!itemId && !!userId,
    queryFn: async (): Promise<MakerRef | null> => {
      const { data: item, error } = await supabase.from('items').select('bar_id, origin_bar_profile_id').eq('id', itemId!).maybeSingle();
      if (error) throw error;
      if (!item?.bar_id && !item?.origin_bar_profile_id) return null;
      const query = supabase.from('profiles').select(MAKER_REF).eq('kind', 'bar');
      const { data } = await (item.bar_id ? query.eq('bar_id', item.bar_id) : query.eq('id', item.origin_bar_profile_id!)).maybeSingle();
      return (data as MakerRef | null) ?? null;
    },
  });
}

export interface MakerCreditRequest {
  item_id: string;
  profile_id: string;
  makes: 'ice' | 'glassware';
  drink_name: string;
  credited_by: string | null;
  created_at: string;
}

/** Credits naming this venue's maker page that wait for its team to confirm. */
export function useMakerCreditRequests(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['maker-credit-requests', barId],
    enabled: !!barId,
    staleTime: 0,
    queryFn: async (): Promise<MakerCreditRequest[]> => {
      const { data, error } = await supabase.rpc('maker_credit_requests', { p_bar_id: barId! });
      if (error) throw error;
      return (data ?? []) as MakerCreditRequest[];
    },
  });
}

/** Say yes to a credit (confirm_maker_credit) or take it off. */
export function useAnswerMakerCredit(barId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ request, yes }: { request: MakerCreditRequest; yes: boolean }) => {
      const { error } = yes
        ? await supabase.rpc('confirm_maker_credit', { p_item_id: request.item_id, p_profile_id: request.profile_id, p_makes: request.makes })
        : await supabase.from('item_maker_credits').delete().eq('item_id', request.item_id).eq('profile_id', request.profile_id).eq('makes', request.makes);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['maker-credit-requests', barId] });
      qc.invalidateQueries({ queryKey: ['maker-drinks'] });
    },
  });
}

/** Save what a maker makes and where it delivers. */
export function useSaveMakerDetails(profileId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ makes, serves }: { makes: string[]; serves: string[] }) => {
      const { error } = await supabase.from('profiles').update({ makes, serves }).eq('id', profileId!);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['bar-publishing'] });
    },
  });
}
