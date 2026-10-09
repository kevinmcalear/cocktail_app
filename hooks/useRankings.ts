import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { fetchPublished } from '@/hooks/usePublished';
import { track } from '@/lib/analytics';
import { viewerScoped } from '@/lib/authCache';
import { toTopDrink, type BarTopDrink } from '@/lib/barTopDrinks';
import { fromSharedBarRow, fromSharedRow, toHadDrink, type BarTally, type HadDrink, type HadRow, type SharedBarRow, type SharedHadRow } from '@/lib/hadDrinks';
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
  /** Set when the bar has shut. Still a valid place to have worked or made a drink. */
  is_closed?: boolean;
  closed_year?: number | null;
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
  item:items!item_id ( name, item_images ( angle, sort_order, is_generated, images ( url ) ) ),
  venue:profiles!venue_profile_id ( display_name, locality, postcode, city, country_code )
`;

/**
 * A bar's published drink you ranked as a guest: `items` hides it from you,
 * so the embedded drink comes back empty. Fill its name and picture from
 * published_items. One the bar has since unpublished stays empty.
 */
async function withPublishedItems<T extends { item_id: string; item: { name: string; item_images: ItemImageLink[] | null } | null }>(rows: T[]): Promise<T[]> {
  const missing = [...new Set(rows.filter((r) => !r.item).map((r) => r.item_id))];
  if (!missing.length) return rows;
  const published = await fetchPublished(missing);
  return rows.map((r) => {
    const d = r.item ? null : published.find((p) => p.id === r.item_id);
    if (!d) return r;
    const item_images: ItemImageLink[] = d.imageUrl ? [{ angle: 'hero', is_generated: d.imageIsGenerated, images: { url: d.imageUrl } }] : [];
    return { ...r, item: { name: d.name, item_images } };
  });
}

/**
 * My list for a drink ("my martinis"), best first: loved, then fine, then
 * didn't like, each in rank_key order. Empty when signed out.
 */
export function useMyRankList(rankedAsItemId: string | null | undefined) {
  const userId = useUserId();
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
      const rows = await withPublishedItems((data ?? []) as unknown as RankEntry[]);
      return rows.map((r) => ({ ...r, score: Number(r.score) })).sort((a, b) => SENTIMENTS.indexOf(a.sentiment) - SENTIMENTS.indexOf(b.sentiment));
    },
  });
}

const HAD_COLUMNS = `
  id, item_id, sentiment, had_on, created_at, score,
  item:items!item_id ( name, item_images ( angle, sort_order, is_generated, images ( url ) ) ),
  list:items!ranked_as_item_id ( name ),
  venue:profiles!venue_profile_id ( id, handle, display_name, avatar_url, locality, city )
`;

/**
 * Every drink I've had and ranked, across all my lists, each with my score
 * and where I had it: what my profile shows. Empty when signed out.
 *
 * ponytail: one unpaginated read. A person ranks dozens or hundreds of
 * drinks, not thousands; page by created_at if someone gets there.
 */
export function useMyHadDrinks() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['my-had', userId],
    enabled: !!userId,
    queryFn: async (): Promise<HadDrink[]> => {
      const { data, error } = await supabase.from('rank_entry_scores').select(HAD_COLUMNS).eq('user_id', userId!);
      if (error) throw error;
      return (await withPublishedItems((data ?? []) as unknown as HadRow[])).map(toHadDrink);
    },
  });
}

/**
 * The drinks someone else has had, from their public profile: the ones they
 * show (profiles.had_mode and each drink's pick), when you're signed in. The
 * server leaves out anything that isn't public (get_profile_drinks).
 */
export function useProfileDrinks(profileId: string | null | undefined, enabled: boolean) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['profile-drinks', profileId, userId],
    enabled: enabled && !!profileId && !!userId,
    queryFn: async (): Promise<HadDrink[]> => {
      const { data, error } = await supabase.rpc('get_profile_drinks', { p_profile_id: profileId });
      if (error) throw error;
      return ((data ?? []) as SharedHadRow[]).map(fromSharedRow);
    },
  });
}

/**
 * The bars someone has had drinks at, with their average at each, from their
 * public profile: the ones they show (profiles.bars_mode and each bar's pick),
 * when you're signed in. The best drink at each is named only when they show
 * that drink too (get_profile_bars).
 */
export function useProfileBars(profileId: string | null | undefined, enabled: boolean) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['profile-bars', profileId, userId],
    enabled: enabled && !!profileId && !!userId,
    queryFn: async (): Promise<BarTally[]> => {
      const { data, error } = await supabase.rpc('get_profile_bars', { p_profile_id: profileId });
      if (error) throw error;
      return ((data ?? []) as SharedBarRow[]).map(fromSharedBarRow);
    },
  });
}

/** Your pick for one drink you've had: shown, hidden or following the mode (null), and its top-four place. */
export interface HadPick {
  onProfile: boolean | null;
  pin: number | null;
}

/** Your picks for the drinks you've had, by rank entry id. Plain JSON. */
export function useMyHadPicks() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['my-had-picks', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Record<string, HadPick>> => {
      const { data, error } = await supabase.from('rank_entries').select('id, on_profile, profile_pin').eq('user_id', userId!).limit(2000);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.id as string, { onProfile: r.on_profile as boolean | null, pin: r.profile_pin as number | null }]));
    },
  });
}

/**
 * Shows, hides or pins one drink you've had on your profile. A pinned drink
 * is a shown one (rank_entries_pin_shown), so hiding unpins it.
 */
export function useSetHadPick() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, onProfile, pin }: { id: string; onProfile: boolean; pin: number | null }) => {
      const { data, error } = await supabase
        .from('rank_entries')
        .update({ on_profile: onProfile, profile_pin: onProfile ? pin : null })
        .eq('id', id)
        .select('id');
      if (error?.code === '23505') throw new Error('That spot in your top four is taken. Unpin a drink first.');
      if (error || !data?.length) throw new Error("Couldn't save that. Check your connection and try again.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-had-picks'] });
      qc.invalidateQueries({ queryKey: ['profile-drinks'] });
      qc.invalidateQueries({ queryKey: ['profile-bars'] });
    },
    onError: () => {},
  });
}

export interface RankTarget {
  id: string;
  name: string;
  bar_id: string | null;
  origin: string | null;
  riff_of_id: string | null;
  riff_of: { id: string; name: string; is_catalog: boolean } | null;
  origin_bar_profile_id: string | null;
  created_by: string | null;
}

/**
 * A bar's signature with no venue behind it (added for the bar's public
 * profile, nobody's own drink): it's had at that bar, so rank it there.
 */
export const signatureBarOf = (t: RankTarget | null | undefined) =>
  t && !t.bar_id && !t.created_by ? t.origin_bar_profile_id : null;

/**
 * The drink being ranked, with what it's a version of (for "my martinis").
 * A bar's published drink comes from published_items for anyone outside the
 * bar, who can't read it in `items`.
 */
export function useRankTarget(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['rank-target', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<RankTarget | null> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, bar_id, origin, riff_of_id, riff_of:riff_of_id ( id, name, is_catalog ), origin_bar_profile_id, created_by')
        .eq('id', itemId!)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as RankTarget;

      const { data: pub, error: pubError } = await supabase
        .from('published_items')
        .select('id, name, bar_id, origin, riff_of_id, origin_bar_profile_id')
        .eq('id', itemId!)
        .eq('is_reference', false)
        .maybeSingle();
      if (pubError) throw pubError;
      if (!pub) return null;
      // The classic it's a version of is in the catalog, which everyone signed in can read.
      const riff = pub.riff_of_id ? await supabase.from('items').select('id, name, is_catalog').eq('id', pub.riff_of_id).maybeSingle() : null;
      if (riff?.error) throw riff.error;
      // published_items doesn't say who made a drink. Signed in, a bar
      // signature reads from `items`, so one with no bar here is a person's:
      // don't default it to the bar it's credited to (signatureBarOf).
      return { ...pub, origin_bar_profile_id: pub.bar_id ? pub.origin_bar_profile_id : null, riff_of: riff?.data ?? null, created_by: null } as RankTarget;
    },
  });
}

const VENUE_COLUMNS = 'id, display_name, locality, postcode, city, country_code, is_closed, closed_year';

/**
 * A bar's public profile: where its drinks can be ranked, and its area. Null
 * if it has none. By venue (bar_id), or by profile id for a bar's signature.
 */
export function useBarProfile(barId: string | null | undefined, profileId?: string | null) {
  return useQuery({
    queryKey: ['bar-profile', barId, profileId ?? null],
    enabled: !!barId || !!profileId,
    queryFn: async (): Promise<RankVenue | null> => {
      const query = supabase.from('profiles').select(VENUE_COLUMNS).eq('kind', 'bar').eq('is_public', true);
      const { data, error } = await (barId ? query.eq('bar_id', barId) : query.eq('id', profileId!)).maybeSingle();
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
    onSuccess: (_, entry) => {
      track('drink_ranked', { rerank: !!entry.id, at_bar: !!entry.venue_profile_id });
      qc.invalidateQueries({ queryKey: ['rank-list'], predicate: (q) => q.queryKey[2] === entry.ranked_as_item_id });
      // Your taste (built from my-had) and For you follow your rankings.
      qc.invalidateQueries({ queryKey: ['flavor-for-you'] });
      qc.invalidateQueries({ queryKey: ['my-had'] });
    },
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

/**
 * A bar's drinks by how people rank them there: scored ones best first, then
 * early ones (a count, no score), then ones nobody has ranked yet, current
 * menu first. Only drinks anyone may see by name. Works signed out; refreshed
 * hourly on the server like every shared score.
 */
export function useBarTopDrinks(profileId: string | null | undefined, limit = 30) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['bar-top-drinks', profileId, limit, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: async (): Promise<BarTopDrink[]> => {
      const { data, error } = await supabase.rpc('get_bar_top_drinks', { p_profile_id: profileId!, p_limit: limit });
      if (error) throw error;
      return ((data ?? []) as BarTopDrink[]).map(toTopDrink);
    },
  });
}
