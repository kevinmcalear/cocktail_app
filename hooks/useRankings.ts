import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import type { ItemImageLink } from '@/lib/itemImages';
import { SENTIMENTS, type Sentiment } from '@/lib/ranking';
import { supabase } from '@/lib/supabase';

// Rankings by comparison (docs/schema_proposal.md, "Rankings"). Row shapes are
// written by hand until types/ is regenerated with #44's schema.

export interface RankVenue {
  id: string;
  display_name: string;
  locality: string | null;
  postcode: string | null;
  city: string | null;
  country_code: string | null;
}

export interface RankEntry {
  id: string;
  item_id: string;
  ranked_as_item_id: string;
  venue_profile_id: string | null;
  sentiment: Sentiment;
  rank_key: number;
  had_on: string | null;
  created_at: string;
  /** Personal 0 to 10 score, from the rank_entry_scores view. */
  score: number;
  item: { name: string; item_images: ItemImageLink[] } | null;
  venue: Omit<RankVenue, 'id'> | null;
}

const ENTRY_COLUMNS = `
  id, item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key, had_on, created_at, score,
  item:items!item_id ( name, item_images ( sort_order, is_generated, images ( url ) ) ),
  venue:profiles!venue_profile_id ( display_name, locality, postcode, city, country_code )
`;

/**
 * My list for a drink ("my martinis"), best first: loved, then fine, then
 * didn't like, each in rank_key order. Empty when signed out.
 */
export function useMyRankList(rankedAsItemId: string | null | undefined) {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: ['rank-list', userId, rankedAsItemId],
    enabled: !!userId && !!rankedAsItemId,
    queryFn: async (): Promise<RankEntry[]> => {
      const { data, error } = await supabase
        .from('rank_entry_scores')
        .select(ENTRY_COLUMNS)
        .eq('ranked_as_item_id', rankedAsItemId!)
        .order('rank_key', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as RankEntry[];
      return rows.map((r) => ({ ...r, score: Number(r.score) })).sort((a, b) => SENTIMENTS.indexOf(a.sentiment) - SENTIMENTS.indexOf(b.sentiment));
    },
  });
}

export interface RankTarget {
  id: string;
  name: string;
  bar_id: string | null;
  origin: string | null;
  riff_of_id: string | null;
  riff_of: { id: string; name: string } | null;
}

/** The drink being ranked, with what it's a version of (for "my martinis"). */
export function useRankTarget(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['rank-target', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<RankTarget | null> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, bar_id, origin, riff_of_id, riff_of:riff_of_id ( id, name )')
        .eq('id', itemId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RankTarget | null;
    },
  });
}

const VENUE_COLUMNS = 'id, display_name, locality, postcode, city, country_code';

/** A bar's public profile: where its drinks can be ranked, and its area. Null if it has none. */
export function useBarProfile(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['bar-profile', barId],
    enabled: !!barId,
    queryFn: async (): Promise<RankVenue | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(VENUE_COLUMNS)
        .eq('kind', 'bar')
        .eq('bar_id', barId!)
        .eq('is_public', true)
        .maybeSingle();
      if (error) throw error;
      return data as RankVenue | null;
    },
  });
}

/** Public bars by name, for "Where did you have it?". */
export function usePublicBars(search: string) {
  const term = search.replace(/[%_\\]/g, '').trim();
  return useQuery({
    queryKey: ['public-bars', term],
    enabled: term.length >= 2,
    queryFn: async (): Promise<RankVenue[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(VENUE_COLUMNS)
        .eq('kind', 'bar')
        .eq('is_public', true)
        .ilike('display_name', `%${term}%`)
        .order('display_name')
        .limit(8);
      if (error) throw error;
      return (data ?? []) as RankVenue[];
    },
  });
}

export interface NewRankEntry {
  /** Set to re-rank an existing entry in place. */
  id?: string;
  item_id: string;
  ranked_as_item_id: string;
  venue_profile_id: string | null;
  sentiment: Sentiment;
  rank_key: number;
  had_on: string;
}

/** Add an entry to my list, or move one I'd ranked before (same id). */
export function useAddRankEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: NewRankEntry): Promise<{ id: string }> => {
      const { data, error } = await supabase.from('rank_entries').upsert(entry).select('id').single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (_, entry) => qc.invalidateQueries({ queryKey: ['rank-list'], predicate: (q) => q.queryKey[2] === entry.ranked_as_item_id }),
  });
}

export interface Comparison {
  winner_entry_id: string;
  loser_entry_id: string;
  /** "Too close to call". */
  is_tie: boolean;
}

/** Keep the raw "which was better?" answers, so the order can be rebuilt later. */
export function useRecordComparisons() {
  return useMutation({
    mutationFn: async (comparisons: Comparison[]) => {
      if (comparisons.length === 0) return;
      const { error } = await supabase.from('rank_comparisons').insert(comparisons);
      if (error) throw error;
    },
  });
}

export type RankScope = 'postcode' | 'city' | 'country';

export interface AreaRanking {
  position: number;
  venue_profile_id: string;
  handle: string;
  display_name: string;
  locality: string | null;
  city: string | null;
  score: number;
  rankers: number;
}

/** The area filters for a scope around a place. Null when the place doesn't say. */
export function areaFor(place: Pick<RankVenue, 'postcode' | 'city' | 'country_code'>, scope: RankScope) {
  if (scope === 'postcode') return place.postcode && place.country_code ? { p_postcode: place.postcode, p_country_code: place.country_code } : null;
  if (scope === 'city') return place.city && place.country_code ? { p_city: place.city, p_country_code: place.country_code } : null;
  return place.country_code ? { p_country_code: place.country_code } : null;
}

/**
 * "Best martini in 3065 / Melbourne / Australia": bars whose version enough
 * people have ranked, best first. Works signed out. Refreshed hourly on the
 * server, so a new ranking takes up to an hour to count.
 */
export function useDrinkRankings(rankedAsItemId: string | null | undefined, area: Record<string, string> | null) {
  return useQuery({
    queryKey: ['drink-rankings', rankedAsItemId, area],
    enabled: !!rankedAsItemId && !!area,
    queryFn: async (): Promise<AreaRanking[]> => {
      const { data, error } = await supabase.rpc('get_drink_rankings', { p_ranked_as_item_id: rankedAsItemId, ...area, p_limit: 20 });
      if (error) throw error;
      return ((data ?? []) as AreaRanking[]).map((r) => ({ ...r, score: Number(r.score) }));
    },
  });
}
