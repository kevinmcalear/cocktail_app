import type { DrinkScores } from '@/components/screens/home/DrinksAtBars';
import { useDiscoverRankings } from '@/hooks/useDiscover';
import { useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { useItemScores } from '@/hooks/useFlavor';
import { barScoresFor, pickFilter, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';

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
