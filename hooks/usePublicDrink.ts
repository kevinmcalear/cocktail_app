import { useQuery } from '@tanstack/react-query';

import { walkAncestors, type CreditStatus } from '@/lib/lineage';
import type { PublicProfile, WhereRow } from '@/lib/publicDrink';
import { rankedAs } from '@/lib/ranking';
import { supabase } from '@/lib/supabase';

import type { PublishedDrink } from './usePublished';

// What the public drink page (/d/<id>) shows past the card: who made it, its
// family tree with scored riffs, and the bars it's best at. Everything reads
// what anon can (published_items, public profiles, get_item_scores,
// get_drink_rankings), so it works signed out. Queries are marked public: a
// signed-out load clears every other query (lib/clearUserData.ts).

const TREE_COLUMNS = 'id, name, origin, origin_year, riff_of_id, bar_id, creator_profile_id, origin_bar_profile_id, credit_status, is_shared';
const PROFILE_COLUMNS = 'id, kind, handle, display_name, avatar_url, locality, city, country_code, is_claimed, bar_id';

interface TreeRow {
  id: string;
  name: string;
  origin: string | null;
  origin_year: number | null;
  riff_of_id: string | null;
  bar_id: string | null;
  creator_profile_id: string | null;
  origin_bar_profile_id: string | null;
  credit_status: CreditStatus | null;
  is_shared: boolean | null;
}

/** A drink in the family tree: who made it and, for a riff, its score. */
export interface TreeDrink {
  id: string;
  name: string;
  origin: string | null;
  originYear: number | null;
  /** The person or bar it's credited to (or its venue's bar). */
  makerId: string | null;
  score: number | null;
}

/** A bar's public profile, with its area (for Where to drink it). */
export interface PublicVenue extends PublicProfile {
  country_code: string | null;
  is_claimed: boolean;
  bar_id: string | null;
}

export interface PublicDrinkMore {
  /** The drink's own bar: its venue's profile, or the bar it's credited to. */
  venue: PublicVenue | null;
  creator: PublicVenue | null;
  /** Root first, not including the drink. */
  ancestors: TreeDrink[];
  /** Best scored first, then by name. */
  riffs: TreeDrink[];
  /** Everyone named above, by id. */
  profiles: Record<string, PublicVenue>;
  /** The drink it's a riff or version of, with its other names (classic_aliases); null when it can't be read. */
  riffOf: { name: string; aliases: string[] } | null;
  /** The list it's ranked in ("Penicillin"): its classic, or itself. */
  rankedAs: { id: string; name: string };
}

const toTree = (r: TreeRow, score: number | null = null): TreeDrink => ({
  id: r.id,
  name: r.name,
  origin: r.origin,
  originYear: r.origin_year,
  makerId: r.creator_profile_id ?? r.origin_bar_profile_id,
  score,
});

async function fetchTreeRow(id: string): Promise<TreeRow | null> {
  const { data, error } = await supabase.from('published_items').select(TREE_COLUMNS).eq('id', id).eq('is_reference', false).maybeSingle();
  if (error) throw error;
  return (data as TreeRow | null) ?? null;
}

/**
 * A catalog classic's parent classic (Penicillin to Gold Rush), which
 * published_items doesn't carry; null for a riff (riff_of_id says) or a root.
 */
async function lineageParent(id: string, riffOfId: string | null): Promise<string | null> {
  if (riffOfId) return null;
  const { data, error } = await supabase.rpc('public_lineage_parent', { p_item_id: id });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Credit, family tree and ranked list for a published drink. */
export function usePublicDrinkMore(drink: PublishedDrink | null | undefined) {
  return useQuery({
    queryKey: ['published', 'drink-more', drink?.id],
    meta: { public: true },
    enabled: !!drink,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<PublicDrinkMore> => {
      const d = drink!;
      const parents: TreeRow[] = [];
      await walkAncestors({ id: d.id, riff_of_id: d.riffOfId, lineage_parent_id: await lineageParent(d.id, d.riffOfId) }, async (id) => {
        const row = await fetchTreeRow(id);
        if (row) parents.push(row);
        return row ? { ...row, creator: null, origin_bar: null, lineage_parent_id: await lineageParent(row.id, row.riff_of_id) } : null;
      });
      parents.reverse();
      // ponytail: the first 200 riffs; the tree shows three and the rest on request.
      const riffRows = await supabase.from('published_items').select(TREE_COLUMNS).eq('riff_of_id', d.id).eq('is_reference', false).order('name').limit(200);
      if (riffRows.error) throw riffRows.error;
      const riffs = (riffRows.data ?? []) as TreeRow[];
      const people = [
        d.creatorProfileId,
        d.originBarProfileId,
        ...parents.flatMap((p) => [p.creator_profile_id, p.origin_bar_profile_id]),
        ...riffs.flatMap((r) => [r.creator_profile_id, r.origin_bar_profile_id]),
      ];
      const ids = [...new Set(people.filter((x): x is string => !!x))];
      const barIds = [...new Set([d.barId, ...parents.map((p) => p.bar_id), ...riffs.map((r) => r.bar_id)].filter((x): x is string => !!x))];
      const [byId, byBar, scores, aliases] = await Promise.all([
        ids.length ? supabase.from('profiles').select(PROFILE_COLUMNS).in('id', ids).eq('is_public', true) : Promise.resolve({ data: [], error: null }),
        barIds.length ? supabase.from('profiles').select(PROFILE_COLUMNS).in('bar_id', barIds).eq('kind', 'bar').eq('is_public', true) : Promise.resolve({ data: [], error: null }),
        riffs.length
          ? supabase.rpc('get_item_scores', {
              p_item_ids: riffs.map((r) => r.id),
            })
          : Promise.resolve({ data: [], error: null }),
        d.riffOfId ? supabase.from('classic_aliases').select('alias').eq('classic_id', d.riffOfId) : Promise.resolve({ data: [], error: null }),
      ]);
      if (aliases.error) throw aliases.error;
      if (byId.error) throw byId.error;
      if (byBar.error) throw byBar.error;
      if (scores.error) throw scores.error;
      const all = [...((byId.data ?? []) as PublicVenue[]), ...((byBar.data ?? []) as PublicVenue[])];
      const profiles: Record<string, PublicVenue> = {};
      for (const p of all) profiles[p.id] = p;
      const venueOfBar = (barId: string | null) => (barId ? (all.find((p) => p.bar_id === barId) ?? null) : null);
      const scoreOf = new Map(((scores.data ?? []) as { item_id: string; score: number }[]).map((s) => [s.item_id, Number(s.score)]));
      // A drink made at a venue is credited to that venue's bar when nobody's named.
      const tree = (r: TreeRow, score: number | null = null) => {
        const t = toTree(r, score);
        return t.makerId ? t : { ...t, makerId: venueOfBar(r.bar_id)?.id ?? null };
      };
      const parent = parents.at(-1) ?? null;
      const parentIsCatalog = !!parent && !!parent.is_shared && !parent.origin_bar_profile_id && !parent.creator_profile_id;
      return {
        venue: venueOfBar(d.barId) ?? (d.originBarProfileId ? (profiles[d.originBarProfileId] ?? null) : null),
        creator: d.creatorProfileId ? (profiles[d.creatorProfileId] ?? null) : null,
        ancestors: parents.map((p) => tree(p)),
        riffOf: parent && parent.id === d.riffOfId ? { name: parent.name, aliases: (aliases.data ?? []).map((a) => a.alias) } : null,
        riffs: riffs.map((r) => tree(r, scoreOf.get(r.id) ?? null)).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name)),
        profiles,
        rankedAs: rankedAs({
          id: d.id,
          name: d.name,
          origin: d.origin,
          riff_of_id: d.riffOfId,
          riff_of: parent ? { id: parent.id, name: parent.name, is_catalog: parentIsCatalog } : null,
        }),
      };
    },
  });
}

/** A bar in Where to drink it. */
export interface WhereBar extends WhereRow {
  position: number;
  handle: string;
  display_name: string;
  locality: string | null;
  city: string | null;
}

/**
 * Where to drink it: bars whose version enough people have ranked, best
 * first, in the drink's own bar's city, or everywhere when it has none.
 * Refreshed hourly on the server.
 */
export function useWhereToDrink(rankedAsId: string | null | undefined, area: { city: string | null; country_code: string | null } | null) {
  const params = area?.city && area.country_code ? { p_city: area.city, p_country_code: area.country_code } : {};
  return useQuery({
    queryKey: ['published', 'where', rankedAsId, params],
    meta: { public: true },
    enabled: !!rankedAsId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<WhereBar[]> => {
      const { data, error } = await supabase.rpc('get_drink_rankings', {
        p_ranked_as_item_id: rankedAsId!,
        ...params,
        p_limit: 100,
      });
      if (error) throw error;
      return ((data ?? []) as WhereBar[]).map((r) => ({
        ...r,
        position: Number(r.position),
        score: Number(r.score),
        rankers: Number(r.rankers),
      }));
    },
  });
}
