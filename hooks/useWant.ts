import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLocales } from 'expo-localization';

import { useUserId } from '@/ctx/AuthContext';
import { foldName } from '@/lib/discover';
import { COLD_START_DRINKS, matchPercent } from '@/lib/flavor';
import { areaParams, nearMeArea, roundCoord, usesMiles } from '@/lib/nearMe';
import { supabase } from '@/lib/supabase';
import { likeLine, matchLabel, nearBars, type NearBar, type NearRow, type Swipe } from '@/lib/want';
import { useLastPlace } from '@/store/useLastPlace';

import { useItemFlavors, useMyTaste } from './useFlavor';

/**
 * Want or not (Loop-want, supabase/migrations/20261206220000_want_passes.sql):
 * the deck of classics to swipe, a swipe's Want (a want_list row, source
 * 'swipe') or Not for me (drink_passes), the Want list's alert switch
 * (user_prefs.want_alerts), each drink's match, and where a wanted drink is
 * on near you. The Want list itself is Collection's drinks (useCollection).
 * Signed in only. Plain JSON.
 */

export interface DeckCard {
  itemId: string;
  name: string;
  description: string | null;
}

/**
 * Classics to swipe: not wanted, passed on or had yet, most ranked first.
 * Read fresh each time the swipe opens and held while it is open, so a
 * swipe doesn't reshuffle the cards under your finger.
 */
export function useWantDeck(limit = 20) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['want-deck', userId, limit],
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: 0,
    meta: { persist: false },
    queryFn: async (): Promise<DeckCard[]> => {
      const { data, error } = await supabase.rpc('want_deck', { p_limit: limit });
      if (error) throw error;
      return (data ?? []).map((r) => ({ itemId: r.item_id, name: r.name, description: r.description || null }));
    },
  });
}

/** Want (to your Want list, from the swipe) or Not for me (the deck skips it from now on). */
export function useWantSwipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, swipe }: { itemId: string; swipe: Swipe }) => {
      const { error } =
        swipe === 'want'
          ? await supabase.from('want_list').insert({ kind: 'drink', item_id: itemId, source: 'swipe' })
          : await supabase.from('drink_passes').insert({ item_id: itemId });
      // 23505: already there (a double tap, or another device).
      if (error && error.code !== '23505') throw new Error(error.message);
    },
    onSettled: (_, __, { swipe }) => (swipe === 'want' ? qc.invalidateQueries({ queryKey: ['collection'] }) : undefined),
  });
}

const alertsKey = (userId: string | null) => ['want-alerts', userId] as const;

/** "Tell me when one's on near you": off until it's turned on. */
export function useWantAlerts() {
  const userId = useUserId();
  return useQuery({
    queryKey: alertsKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.from('user_prefs').select('want_alerts').maybeSingle();
      if (error) throw error;
      return data?.want_alerts ?? false;
    },
  });
}

/** Turn want alerts on or off (owner-only row in user_prefs). Shows the change at once and puts it back if the save fails. */
export function useSetWantAlerts() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) => {
      if (!userId) throw new Error('Sign in to get alerts.');
      const { error } = await supabase.from('user_prefs').upsert({ user_id: userId, want_alerts: on });
      if (error) throw error;
    },
    onMutate: (on) => {
      const before = qc.getQueryData<boolean>(alertsKey(userId));
      qc.setQueryData(alertsKey(userId), on);
      return { before };
    },
    onError: (_, __, context) => qc.setQueryData(alertsKey(userId), context?.before ?? false),
    onSettled: () => qc.invalidateQueries({ queryKey: alertsKey(userId) }),
  });
}

/**
 * How well these drinks fit your taste: "92% match" and why ("You like
 * sour, fruity, not too sweet"). Shown once your taste says something: your
 * answers at setup, or enough ranked drinks. Nothing for a drink with no
 * flavour profile.
 */
export function useWantMatches(itemIds: readonly string[]) {
  const { data: me } = useMyTaste();
  const taste = me && (me.rankedDrinks >= COLD_START_DRINKS || me.answers) ? me.taste : null;
  const { data: profiles } = useItemFlavors(itemIds, !!taste);
  const profileOf = (id: string) => (taste ? profiles?.[id] : undefined);
  return {
    taste,
    matchFor: (id: string) => {
      const p = profileOf(id);
      return p ? matchLabel(matchPercent(taste!, p)) : null;
    },
    likeFor: (id: string) => {
      const p = profileOf(id);
      return p ? likeLine(taste!, p) : null;
    },
  };
}

/** Bars searched per drink: the nearest few is all a row shows. */
const NEAR_LIMIT = 10;

/**
 * Where each drink is on a menu now near you (Discover's list, near where
 * near me last found you, on now, searched by the drink's name; lib/want.ts
 * nearBars keeps the bars that really pour it). `known` is false until near
 * me has found you once: then nothing is "near".
 * ponytail: one discover_list call per drink; a Want list runs to dozens. A
 * want_near(item_ids) RPC answering by riff_of_id in one call is the upgrade.
 */
export function useOnNearYou(drinks: readonly { itemId: string; name: string }[]) {
  const place = useLastPlace((s) => s.place);
  const where = place ? areaParams(nearMeArea(place)) : null;
  const from = place ? { p_from_latitude: roundCoord(place.latitude), p_from_longitude: roundCoord(place.longitude) } : null;
  const results = useQueries({
    queries: drinks.map((d) => ({
      queryKey: ['want-near', d.itemId, foldName(d.name), where],
      enabled: !!where,
      staleTime: 10 * 60 * 1000,
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<NearBar[]> => {
        const params = { ...where, ...from, p_query: foldName(d.name), p_on_now: true, p_limit: NEAR_LIMIT };
        const { data, error } = await supabase.rpc('discover_list', params).abortSignal(signal);
        if (error) throw error;
        return nearBars((data ?? []) as NearRow[], d.name);
      },
    })),
  });
  const byItem: Record<string, NearBar[]> = {};
  drinks.forEach((d, i) => {
    const bars = results[i]?.data;
    if (bars) byItem[d.itemId] = bars;
  });
  return { byItem, known: !!place, isLoading: results.some((r) => r.isLoading), miles: usesMiles(getLocales()[0]) };
}
