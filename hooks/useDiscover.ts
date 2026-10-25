import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { readBarBrands } from '@/hooks/useBarBrands';
import type { RankVenue } from '@/hooks/useRankings';
import { allRowsById } from '@/lib/allRows';
import { viewerScoped } from '@/lib/authCache';
import type { PublicBrand } from '@/lib/brand';
import { citiesFrom, findDrinks, orderDrinks, type City } from '@/lib/discover';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import {
  ADDRESS_DEBOUNCE_MS,
  ADDRESS_MIN_CHARS,
  areaParams,
  photonUrl,
  splitEarly,
  venueAddressesFrom,
  type Area,
  type DiscoverRow,
  type VenueAddress,
} from '@/lib/nearMe';
import { supabase } from '@/lib/supabase';

export interface DrinkList {
  id: string;
  name: string;
  imageUrl: string | null;
}

/**
 * The drink catalog: the shared classics you can find "the best" of (Martini,
 * Negroni). A bar's own martini is ranked in the Martini list through its
 * riff_of_id. Best-known first. Signed-in only, like every shared item.
 * `enabled` false skips the read (Library asks only while finding).
 */
export function useDrinkLists(enabled = true) {
  return useQuery({
    queryKey: ['drink-lists'],
    enabled,
    queryFn: async (): Promise<DrinkList[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, item_images ( angle, sort_order, is_generated, images ( url ) )')
        .eq('is_catalog', true)
        .order('name');
      if (error) throw error;
      const rows = (data ?? []) as unknown as { id: string; name: string; item_images: ItemImageLink[] | null }[];
      return orderDrinks(rows.map((r) => ({ id: r.id, name: r.name, imageUrl: heroPicture(r.item_images)?.url ?? null })));
    },
  });
}

/**
 * Which classic the map's "Best …" layer is about: the best match for what's
 * searched (or the picked style's classic), else the best-known drink.
 */
export function useDrinkPick(hint: string): DrinkList | null {
  const all = useDrinkLists().data ?? [];
  return findDrinks(all, hint)[0] ?? all[0] ?? null;
}

/**
 * Cities with public bars, busiest first, for "Best Martini in …". Works
 * signed out. ponytail: reads every public bar's city, fine for a few
 * thousand bars. Upgrade path: an RPC that groups by city in SQL.
 */
export function useBarCities() {
  return useQuery({
    queryKey: ['bar-cities'],
    queryFn: async (): Promise<City[]> =>
      citiesFrom(
        await allRowsById((after, size) => {
          let query = supabase
            .from('profiles')
            .select('id, city, country_code')
            .eq('kind', 'bar')
            .eq('is_public', true)
            .eq('is_closed', false)
            .not('city', 'is', null);
          if (after) query = query.gt('id', after);
          return query.order('id').limit(size);
        })
      ),
  });
}

// --- Near me, top bars, bar scores ---

/** Queries keyed by a point: kept in memory only, never saved to storage (lib/react-query.ts). */
const pointMeta = (area: Area) => (area.kind === 'point' ? { persist: false } : undefined);

function asRows(data: unknown): DiscoverRow[] {
  return ((data ?? []) as DiscoverRow[]).map((r) => ({ ...r, score: r.score === null ? null : Number(r.score) }));
}

/**
 * Each bar's logo (its profile avatar, else its venue's public Brand logo),
 * for the lists and the map. Logos are decoration, so a failed read leaves
 * them out rather than failing the list.
 * ponytail: second reads after the RPC, side by side. Upgrade path: return
 * avatar_url from discover_top_bars and discover_drink_rankings (needs a migration).
 */
async function withLogos(rows: DiscoverRow[]): Promise<DiscoverRow[]> {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.venue_profile_id);
  const [{ data }, brands] = await Promise.all([supabase.from('profiles').select('id, avatar_url').in('id', ids), readBarBrands(ids).catch(() => ({}) as Record<string, PublicBrand>)]);
  const logos = new Map((data ?? []).map((p) => [p.id, p.avatar_url]));
  return rows.map((r) => ({ ...r, avatar_url: logos.get(r.venue_profile_id) ?? brands[r.venue_profile_id]?.logo ?? null }));
}

/**
 * "Best Martini near you / in New York / anywhere": ranked bars, then early
 * ones (below the ranker minimum, no score). Works signed out.
 */
export function useDiscoverRankings(rankedAsItemId: string | null | undefined, area: Area, enabled = true) {
  const params = areaParams(area);
  // The viewer's loved bars lead the early ones, so the list is theirs.
  const viewer = viewerScoped(useAuth().user?.id);
  return useQuery({
    queryKey: ['discover-rankings', rankedAsItemId, params, viewer.key],
    enabled: enabled && !!rankedAsItemId,
    meta: { ...viewer.meta, ...pointMeta(area) },
    queryFn: async () => {
      const { data, error } = await supabase.rpc('discover_drink_rankings', { p_ranked_as_item_id: rankedAsItemId!, ...params, p_limit: 20 });
      if (error) throw error;
      return splitEarly(await withLogos(asRows(data)));
    },
  });
}

/**
 * "Top bars near you": bars by their bar score, then early ones (including
 * bars nobody has ranked yet): the viewer's loved bars first, then the most
 * relevant (discover_top_bars). Up to 50, so a seeded list like The World's
 * 50 Best Bars fits whole. Works signed out.
 */
export function useTopBars(area: Area, enabled = true) {
  const params = areaParams(area);
  const viewer = viewerScoped(useAuth().user?.id);
  return useQuery({
    queryKey: ['discover-top-bars', params, viewer.key],
    enabled,
    meta: { ...viewer.meta, ...pointMeta(area) },
    queryFn: async () => {
      const { data, error } = await supabase.rpc('discover_top_bars', { ...params, p_limit: 50 });
      if (error) throw error;
      return splitEarly(await withLogos(asRows(data)));
    },
  });
}

export interface VenueScore {
  /** Null while early. */
  score: number | null;
  rankers: number;
  drinks: number;
  is_early: boolean;
}

async function readVenueScore(profileId: string): Promise<VenueScore | null> {
  const { data, error } = await supabase.rpc('get_venue_score', { p_venue_profile_id: profileId });
  if (error) throw error;
  const row = ((data ?? []) as VenueScore[])[0];
  return row ? { ...row, score: row.score === null ? null : Number(row.score) } : null;
}

/** A bar's score for its profile. Null when nobody has ranked a drink there yet. */
export function useVenueScore(profileId: string | null | undefined) {
  const viewer = viewerScoped(useAuth().user?.id);
  return useQuery({
    queryKey: ['venue-score', profileId, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: () => readVenueScore(profileId!),
  });
}

/**
 * Several bars' scores at once (Collection's Bars), each from the same cache
 * as useVenueScore: profile id to score, missing until it's known or while
 * the bar is too early to score.
 * ponytail: one RPC per bar, fine for the dozens of bars someone keeps.
 * Upgrade path: a batched get_venue_scores(ids) RPC (needs a migration).
 */
export function useVenueScores(profileIds: readonly string[]): Map<string, number> {
  const viewer = viewerScoped(useAuth().user?.id);
  return useQueries({
    queries: profileIds.map((id) => ({ queryKey: ['venue-score', id, viewer.key], meta: viewer.meta, queryFn: () => readVenueScore(id) })),
    combine: (results) => new Map(results.flatMap((r, i) => (r.data?.score != null ? [[profileIds[i], r.data.score] as const] : []))),
  });
}

// --- Adding a bar ---

/** Waits until typing pauses before passing a value on. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/**
 * Addresses and named places matching what's typed, from Photon
 * (OpenStreetMap). Keeps to Photon's fair use: nothing under three
 * characters, only once typing pauses, a superseded request is cancelled,
 * and answers are cached. Sends only the typed text, never the person's
 * location.
 */
export function useAddressSearch(text: string) {
  const query = useDebounced(text.trim(), ADDRESS_DEBOUNCE_MS);
  return useQuery({
    queryKey: ['address-search', query],
    enabled: query.length >= ADDRESS_MIN_CHARS,
    staleTime: 60 * 60 * 1000,
    retry: 0,
    meta: { persist: false },
    queryFn: async ({ signal }): Promise<VenueAddress[]> => {
      const res = await fetch(photonUrl(query), { signal });
      if (!res.ok) throw new Error(`Address search failed (${res.status}). Try again in a moment.`);
      return venueAddressesFrom(await res.json());
    },
  });
}

/** The bar that was just added, as ranking and Discover need it. */
export type AddedVenue = RankVenue & { handle: string };

/** add_venue's refusal for a bar already on Cocktail, with its id when it's public. */
export class DuplicateVenueError extends Error {
  existingId: string | null;
  constructor(message: string, existingId: string | null) {
    super(message);
    this.existingId = existingId;
  }
}

/** Adds a bar someone visited as a public, unclaimed profile. Moderators can hide or remove it; the bar claims it. */
export function useAddVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, address }: { name: string; address: VenueAddress }): Promise<AddedVenue> => {
      const { data, error } = await supabase.rpc('add_venue', {
        p_name: name,
        p_address_line: address.address_line,
        p_city: address.city,
        p_country_code: address.country_code,
        p_latitude: address.latitude,
        p_longitude: address.longitude,
        p_postcode: address.postcode,
        p_region: address.region,
        p_locality: address.locality,
      });
      if (error) {
        if (error.code === '23505') throw new DuplicateVenueError(error.message, error.details || null);
        throw new Error(error.message);
      }
      const p = data as AddedVenue;
      return { id: p.id, handle: p.handle, display_name: p.display_name, locality: p.locality, postcode: p.postcode, city: p.city, country_code: p.country_code };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public-bars'] });
      qc.invalidateQueries({ queryKey: ['bar-cities'] });
    },
    // Shown inline by the form, not as the global toast.
    onError: () => {},
  });
}
