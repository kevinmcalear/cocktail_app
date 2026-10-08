import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { chunk } from '@/lib/commandSearchGrid';
import { blendTaste, DIMENSIONS, MIN_COVERAGE, type FlavorDrink, type Profile, type Taste, type TasteBasis } from '@/lib/flavor';
import { supabase } from '@/lib/supabase';

// Flavor profiles and your taste (supabase/migrations/20260928300000_flavor_profiles.sql).
// Row shapes are written by hand until types/ is regenerated.

const DIM_COLUMNS = DIMENSIONS.join(', ');

export interface ItemFlavor {
  profile: Profile;
  coverage: number;
  source: 'rules' | 'ai';
}

type FlavorRow = Record<(typeof DIMENSIONS)[number], number> & { coverage: number; source: 'rules' | 'ai' };

const profileOf = (row: Partial<Record<(typeof DIMENSIONS)[number], number | null>>): Profile =>
  Object.fromEntries(DIMENSIONS.map((d) => [d, Number(row[d] ?? 0)])) as Profile;

/** A drink's flavor profile, or null when it hasn't been worked out (or the spec says too little). */
export function useItemFlavor(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['item-flavor', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<ItemFlavor | null> => {
      const { data, error } = await supabase
        .from('item_flavors')
        .select(`${DIM_COLUMNS}, coverage, source`)
        .eq('item_id', itemId!)
        .maybeSingle();
      if (error) throw error;
      const row = data as FlavorRow | null;
      if (!row || row.coverage < MIN_COVERAGE) return null;
      return { profile: profileOf(row), coverage: row.coverage, source: row.source };
    },
  });
}

export interface MyTaste {
  taste: Taste;
  basis: TasteBasis;
  /** Ranked drinks that went into it. */
  rankedDrinks: number;
  /** The quick answers, if any. */
  answers: Taste | null;
}

/**
 * Your taste: from the drinks you ranked (get_my_taste, which only ever reads
 * your own), or your quick answers until there are enough. Signed out: null.
 */
export function useMyTaste() {
  const userId = useAuth().user?.id ?? null;
  const ranked = useQuery({
    queryKey: ['my-taste', userId],
    enabled: !!userId,
    queryFn: async (): Promise<{ taste: Taste | null; drinks: number }> => {
      const { data, error } = await supabase.rpc('get_my_taste');
      if (error) throw error;
      const row = ((data ?? []) as (Partial<FlavorRow> & { drinks: number })[])[0];
      if (!row?.drinks) return { taste: null, drinks: 0 };
      return { taste: profileOf(row), drinks: row.drinks };
    },
  });
  const answers = useQuery({
    queryKey: ['taste-answers', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Taste | null> => {
      const { data, error } = await supabase.from('user_prefs').select('taste_answers').maybeSingle();
      if (error) throw error;
      return ((data as { taste_answers: Taste | null } | null)?.taste_answers ?? null);
    },
  });
  if (!userId || !ranked.data || answers.isLoading) return { data: null, isLoading: !!userId && (ranked.isLoading || answers.isLoading) };
  const { taste, basis } = blendTaste(ranked.data.taste, ranked.data.drinks, answers.data ?? null);
  const data: MyTaste = { taste, basis, rankedDrinks: ranked.data.drinks, answers: answers.data ?? null };
  return { data, isLoading: false };
}

/** Save the quick answers (owner-only row in user_prefs). */
export function useSaveTasteAnswers() {
  const userId = useAuth().user?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (answers: Taste) => {
      if (!userId) throw new Error('Sign in to save your taste.');
      const { error } = await supabase.from('user_prefs').upsert({ user_id: userId, taste_answers: answers });
      if (error) throw error;
      return answers;
    },
    onSuccess: (answers) => qc.setQueryData(['taste-answers', userId], answers),
  });
}

/**
 * The average profile of the drinks you can see (flavor_baseline): what
 * "usual" means in match reasons. Null until it loads, or when there are none.
 */
export function useFlavorBaseline() {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: ['flavor-baseline', userId],
    enabled: !!userId,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.rpc('flavor_baseline');
      if (error) throw error;
      const row = ((data ?? []) as (Partial<FlavorRow> & { drinks: number })[])[0];
      return row?.drinks ? profileOf(row) : null;
    },
  });
}

interface ForYouRow extends Record<(typeof DIMENSIONS)[number], number> {
  id: string;
  name: string;
  image_url: string | null;
  is_classic: boolean;
  riff_of_id: string | null;
}

/** The drinks nearest your taste, nearest first, leaving out ones you've ranked (flavor_for_you). */
export function useForYouDrinks(taste: Taste | null | undefined, limit = 10) {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: ['flavor-for-you', userId, taste, limit],
    enabled: !!userId && !!taste,
    queryFn: async (): Promise<FlavorDrink[]> => {
      const { data, error } = await supabase.rpc('flavor_for_you', { p_taste: taste, p_limit: limit });
      if (error) throw error;
      return ((data ?? []) as ForYouRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        imageUrl: r.image_url,
        isClassic: r.is_classic,
        riffOfId: r.riff_of_id,
        profile: profileOf(r),
      }));
    },
  });
}

/** Public scores for these drinks, where enough people have ranked them ({ id: score }). */
export function useItemScores(itemIds: readonly string[]) {
  const ids = [...itemIds].sort().slice(0, 200);
  return useQuery({
    queryKey: ['item-scores', ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.rpc('get_item_scores', { p_item_ids: ids });
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as { item_id: string; score: number }[]).map((r) => [r.item_id, Number(r.score)]));
    },
  });
}

/**
 * Usable profiles for these drinks only ({ id: profile }), in URL-sized
 * batches: My Bar's match percentages for the drinks it has loaded.
 */
export function useItemFlavors(itemIds: readonly string[], enabled = true) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['item-flavors', ids],
    enabled: enabled && ids.length > 0,
    placeholderData: keepPreviousData,
    meta: { persist: false },
    queryFn: async (): Promise<Record<string, Profile>> => {
      const batches = await Promise.all(
        chunk(ids, 150).map(async (batch) => {
          const { data, error } = await supabase.from('item_flavors').select(`item_id, ${DIM_COLUMNS}`).in('item_id', batch).gte('coverage', MIN_COVERAGE);
          if (error) throw error;
          return (data ?? []) as unknown as (FlavorRow & { item_id: string })[];
        })
      );
      return Object.fromEntries(batches.flat().map((r) => [r.item_id, profileOf(r)]));
    },
  });
}
