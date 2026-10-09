import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { chunk } from '@/lib/commandSearchGrid';
import { blendTaste, DIMENSIONS, MIN_COVERAGE, type FlavorDrink, type Profile, type Taste, type TasteBasis } from '@/lib/flavor';
import { tasteFromRankings, type RankedFlavor } from '@/lib/palate';
import { supabase } from '@/lib/supabase';

import { useMyHadDrinks } from './useRankings';

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
  /** Ranked drinks (with a profile) that went into it. */
  rankedDrinks: number;
  /** What your rankings alone say, before your answers are blended in. */
  rankedTaste: Taste | null;
  /** The quick answers, if any. */
  answers: Taste | null;
  /** Each drink you ranked that has a profile: what shaped it (lib/palate.ts). */
  entries: RankedFlavor[];
  /** The average drink your rankings are measured against. */
  baseline: Profile | null;
}

/**
 * Your taste: the drinks you ranked, loved ones pulling and disliked ones
 * pushing (tasteFromRankings), blended with your answers (blendTaste).
 * Built from your own rankings (useMyHadDrinks) and their profiles, so it
 * moves the moment you rank. Signed out: null.
 */
export function useMyTaste() {
  const userId = useUserId();
  const had = useMyHadDrinks();
  const ids = (had.data ?? []).map((d) => d.itemId);
  const flavors = useItemFlavors(ids, !!had.data, true);
  const baseline = useFlavorBaseline();
  const answers = useQuery({
    queryKey: ['taste-answers', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Taste | null> => {
      const { data, error } = await supabase.from('user_prefs').select('taste_answers').maybeSingle();
      if (error) throw error;
      return ((data as { taste_answers: Taste | null } | null)?.taste_answers ?? null);
    },
  });
  const error = had.error ?? answers.error ?? flavors.error ?? null;
  const waiting = !had.data || answers.isLoading || baseline.isLoading || (ids.length > 0 && !flavors.data);
  if (!userId || waiting) return { data: null, isLoading: !!userId && !error, error };
  const entries: RankedFlavor[] = had.data!.flatMap((d) => {
    const profile = flavors.data?.[d.itemId];
    return profile ? [{ itemId: d.itemId, name: d.name, score: d.score, sentiment: d.sentiment, createdAt: d.createdAt, profile }] : [];
  });
  const ranked = tasteFromRankings(entries, baseline.data ?? null);
  const rankedDrinks = ranked?.drinks ?? 0;
  const { taste, basis } = blendTaste(ranked?.taste ?? null, rankedDrinks, answers.data ?? null);
  const data: MyTaste = { taste, basis, rankedDrinks, rankedTaste: ranked?.taste ?? null, answers: answers.data ?? null, entries, baseline: baseline.data ?? null };
  return { data, isLoading: false, error };
}

/** Save your answers (owner-only row in user_prefs). Empty clears them. */
export function useSaveTasteAnswers() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (answers: Taste): Promise<Taste | null> => {
      if (!userId) throw new Error('Sign in to save your taste.');
      const saved = Object.keys(answers).length ? answers : null;
      const { error } = await supabase.from('user_prefs').upsert({ user_id: userId, taste_answers: saved });
      if (error) throw error;
      return saved;
    },
    onSuccess: (answers) => qc.setQueryData(['taste-answers', userId], answers),
  });
}

/**
 * The average profile of the drinks you can see (flavor_baseline): what
 * "usual" means in match reasons. Null until it loads, or when there are none.
 */
export function useFlavorBaseline() {
  const userId = useUserId();
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
  const userId = useUserId();
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

/** Public scores for these drinks, where enough people have ranked them ({ id: score }). get_item_scores takes 200 at a time. */
export function useItemScores(itemIds: readonly string[]) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['item-scores', ids],
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    // A long list of ids is a big key: keep it in memory only.
    meta: ids.length > 200 ? { persist: false } : undefined,
    queryFn: async (): Promise<Record<string, number>> => {
      const batches = await Promise.all(
        chunk(ids, 200).map(async (batch) => {
          const { data, error } = await supabase.rpc('get_item_scores', { p_item_ids: batch });
          if (error) throw error;
          return (data ?? []) as { item_id: string; score: number }[];
        })
      );
      return Object.fromEntries(batches.flat().map((r) => [r.item_id, Number(r.score)]));
    },
  });
}

/**
 * Usable profiles for these drinks only ({ id: profile }), in URL-sized
 * batches: My Bar's match percentages for the drinks it has loaded, and your
 * taste's ranked drinks (kept between launches, so your taste works offline).
 */
export function useItemFlavors(itemIds: readonly string[], enabled = true, keep = false) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['item-flavors', ids, ...(keep ? ['kept'] : [])],
    enabled: enabled && ids.length > 0,
    placeholderData: keepPreviousData,
    meta: { persist: keep },
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
