import { useQuery } from '@tanstack/react-query';

import { areaFor, signatureBarOf, useBarProfile, useDrinkRankings, useRankTarget } from '@/hooks/useRankings';
import { viewerScoped } from '@/lib/authCache';
import { useUserId } from '@/ctx/AuthContext';
import { rankedAs } from '@/lib/ranking';
import { supabase } from '@/lib/supabase';

/** What the line under a drink's credit says about how people rank it. Plain JSON. */
export interface DrinkScore {
  score: number;
  rankers: number;
  /** "#2 in Fitzroy": the bar's place for this drink in its own area, when it has one. */
  position: number | null;
  area: string | null;
}

/**
 * One drink's shared score and how many people it's from (get_item_scores),
 * where enough people have ranked it. Null otherwise. Works signed out.
 */
export function useItemScore(itemId: string | null | undefined) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['item-score', itemId, viewer.key],
    meta: viewer.meta,
    enabled: !!itemId,
    queryFn: async (): Promise<{ score: number; rankers: number } | null> => {
      const { data, error } = await supabase.rpc('get_item_scores', { p_item_ids: [itemId!] });
      if (error) throw error;
      const row = ((data ?? []) as { score: number; rankers: number }[])[0];
      return row ? { score: Number(row.score), rankers: Number(row.rankers) } : null;
    },
  });
}

/**
 * The score caption under a drink's name: a bar's drink reads its bar's score
 * and place in the bar's area ("8.9 · #2 in Fitzroy · 146 ranked"); anything
 * else its own shared score ("8.8 · 212 ranked"). Null until enough people
 * have ranked it.
 */
export function useDrinkScore(itemId: string | null | undefined): DrinkScore | null {
  const { data: target } = useRankTarget(itemId);
  const list = target ? rankedAs(target) : null;
  const { data: home } = useBarProfile(target?.bar_id, signatureBarOf(target));
  // The bar's neighbourhood ("Fitzroy"), else its city.
  const byPostcode = home ? areaFor(home, 'postcode') : null;
  const area = (byPostcode ?? (home ? areaFor(home, 'city') : null)) as Record<string, string> | null;
  const areaName = byPostcode ? (home?.locality ?? home?.postcode ?? null) : (home?.city ?? null);
  const { data: ranked } = useDrinkRankings(home ? list?.id : null, area);
  const { data: own } = useItemScore(itemId);
  const mine = home ? ranked?.find((r) => r.venue_profile_id === home.id) : undefined;
  if (mine) return { score: mine.score, rankers: mine.rankers, position: mine.position, area: areaName };
  return own ? { ...own, position: null, area: null } : null;
}
