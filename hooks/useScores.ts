import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { viewerScoped } from '@/lib/authCache';
import type { BarGuestSays, BarScore, DrinkGuestSays, DrinkScore, MyDrinkSays } from '@/lib/scores';
import { supabase } from '@/lib/supabase';

// Scores as the published method says (20261206210000_score_recency.sql).
// Every score is refreshed hourly on the server, so these keep for a while.
const HOUR = 60 * 60 * 1000;

/**
 * A bar drink's public score: people so far against the floor, the score
 * once past it, the score before this spec, six months of history and its
 * places in the city and postcode lists. Null for a drink with no public bar
 * page (a home drink, a catalog classic, a private bar). Works signed out.
 */
export function useDrinkScore(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['drink-score', itemId],
    enabled: !!itemId,
    staleTime: HOUR / 4,
    queryFn: async (): Promise<DrinkScore | null> => {
      const { data, error } = await supabase.rpc('get_drink_score', { p_item_id: itemId! });
      if (error) throw error;
      return (data as unknown as DrinkScore | null) ?? null;
    },
  });
}

/** A public bar's score from its drinks (once 50 ranks are in) and its best three. Works signed out. */
export function useBarScore(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ['bar-score', profileId],
    enabled: !!profileId,
    staleTime: HOUR / 4,
    queryFn: async (): Promise<BarScore | null> => {
      const { data, error } = await supabase.rpc('get_bar_score', { p_profile_id: profileId! });
      if (error) throw error;
      return (data as unknown as BarScore | null) ?? null;
    },
  });
}

/** What guests say about one of the bar's drinks, by spec version. Its Drink Creators only (the server refuses others). */
export function useDrinkGuestSays(itemId: string | null | undefined) {
  const userId = useUserId();
  const viewer = viewerScoped(userId);
  return useQuery({
    queryKey: ['drink-guest-says', itemId, viewer.key],
    meta: viewer.meta,
    enabled: !!itemId && !!userId,
    queryFn: async (): Promise<DrinkGuestSays> => {
      const { data, error } = await supabase.rpc('get_drink_guest_says', { p_item_id: itemId! });
      if (error) throw error;
      return data as unknown as DrinkGuestSays;
    },
  });
}

/** The drinks credited to you, with what guests say about each one's current spec. Only yours. */
export function useMyDrinksGuestSays() {
  const userId = useUserId();
  const viewer = viewerScoped(userId);
  return useQuery({
    queryKey: ['my-drinks-guest-says', viewer.key],
    meta: viewer.meta,
    enabled: !!userId,
    queryFn: async (): Promise<MyDrinkSays[]> => {
      const { data, error } = await supabase.rpc('get_my_drinks_guest_says');
      if (error) throw error;
      return (data ?? []) as unknown as MyDrinkSays[];
    },
  });
}

/** What guests say about the bar and its room, for its Admins. */
export function useBarGuestSays(barId: string | null | undefined) {
  const userId = useUserId();
  const viewer = viewerScoped(userId);
  return useQuery({
    queryKey: ['bar-guest-says', barId, viewer.key],
    meta: viewer.meta,
    enabled: !!barId && !!userId,
    queryFn: async (): Promise<BarGuestSays> => {
      const { data, error } = await supabase.rpc('get_bar_guest_says', { p_bar_id: barId! });
      if (error) throw error;
      return data as unknown as BarGuestSays;
    },
  });
}
