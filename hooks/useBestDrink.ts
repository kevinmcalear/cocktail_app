import { useMemo } from 'react';

import type { DrinkScores } from '@/components/screens/home/DrinksAtBars';
import { useDiscoverRankings, useDrinkPick, useTopBars } from '@/hooks/useDiscover';
import { useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { useItemScores } from '@/hooks/useFlavor';
import { barScoresFor, pickFilter, venueScores, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';
import { foldName } from '@/lib/discover';
import { areaLabel, type Area } from '@/lib/nearMe';
import { rankCaption } from '@/lib/ranking';

/** Stand-ins for "nothing yet" that keep the same identity between renders, so the pins aren't rebuilt. */
const NO_DRINKS: DiscoverDrink[] = [];
const NO_ROWS: never[] = [];
const NO_SCORES: Readonly<Record<string, number>> = {};

/**
 * "Best Martini" ("Top rated" while searching): every one of the picked
 * drink in the area, the scores people gave each, and each bar's score for
 * it. The map and the wide list's tapped bar both read it, from the same
 * cached queries, so they show the same scores.
 *
 * `load`: fetch (the map loads it ahead, before the layer is picked).
 * `active`: the layer is showing, so `picked` and `scores` are filled.
 */
export function useBestDrink(drink: { id: string; name: string } | null, filter: DrinkFilter, { load, active }: { load: boolean; active: boolean }) {
  const rankings = useDiscoverRankings(drink?.id, filter.area, load);
  const list = useDiscoverList(drink ? pickFilter(filter, drink.name) : filter, { enabled: !!drink && load, pageSize: 300 });
  const drinkScores = useItemScores(drink ? list.drinks.map((d) => d.id) : NO_ROWS).data ?? NO_SCORES;
  const on = active && !!drink;
  const picked = on ? list.drinks : NO_DRINKS;
  const scores: DrinkScores | undefined = on ? { drinks: drinkScores, bars: barScoresFor(picked, drinkScores, rankings.data?.ranked ?? NO_ROWS) } : undefined;
  return { picked, scores, isLoading: list.isLoading };
}

/**
 * The scores at the end of any list of drinks at bars (b02): each drink's
 * own and its bar's ("Bar 9.1"), from the same cached queries the map's
 * layers use. Also the pins' bar scores on the drinks layer.
 *
 * ponytail: bar scores come from the area's top bars (discover_top_bars, up
 * to 50 ranked), so a bar ranked below those shows no "Bar" line. Upgrade
 * path: a batched get_venue_scores(ids) RPC (needs a migration).
 */
export function useRowScores(drinks: readonly DiscoverDrink[], area: Area, enabled = true): DrinkScores {
  const drinkScores = useItemScores(enabled ? drinks.map((d) => d.id) : NO_ROWS).data ?? NO_SCORES;
  const bars = useTopBars(area, enabled);
  const ranked = bars.data?.ranked ?? NO_ROWS;
  return useMemo(() => ({ drinks: drinkScores, bars: venueScores(ranked) }), [drinkScores, ranked]);
}

/**
 * A drink a search found, scored and placed (disc-search-pin): its score and
 * where its bar's version stands in the area's list for the classic it is
 * ("#2 of 11 Martinis near you · 23 ranked"). The classic is the best match
 * for what was searched, when the drink's name says it (a Dirty Martini is a
 * martini) or it matched as a riff on it; otherwise there's no rank line.
 */
export function useDrinkRank(drink: DiscoverDrink | undefined, hint: string, area: Area) {
  const pick = useDrinkPick(hint.trim() || drink?.name || '');
  const is = !!drink && !!pick && (foldName(drink.name).includes(foldName(pick.name)) || (drink.match?.kind === 'riff' && foldName(drink.match.text ?? '') === foldName(pick.name)));
  const rankings = useDiscoverRankings(is ? pick.id : null, area, is);
  const score = useItemScores(drink ? [drink.id] : NO_ROWS).data?.[drink?.id ?? ''];
  const ranked = rankings.data?.ranked ?? NO_ROWS;
  const row = drink ? ranked.find((r) => r.venue_profile_id === drink.barId) : undefined;
  return {
    score,
    caption: row && pick ? rankCaption({ position: row.position, of: ranked.length, name: pick.name, where: areaLabel(area), rankers: row.rankers }) : null,
  };
}
