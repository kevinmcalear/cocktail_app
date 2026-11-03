import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useDiscoverBars, useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { drinkRuns } from '@/hooks/drinkRuns';
import { findDrinks, namedFirst } from '@/lib/discover';
import { nearMeArea, type Area } from '@/lib/nearMe';
import { menusOnNow } from '@/lib/rankIt';
import { useLastPlace } from '@/store/useLastPlace';

/** How many drinks and bars the Rank it sheet shows near you. */
const NEAR_DRINKS = 6;
const NEAR_BARS = 3;
/** Read more than are shown: the ones named what's typed go first (namedFirst). */
const NEAR_READ = 24;

/**
 * Near you in the Rank it sheet: the drinks that match what's typed on bars'
 * lists on now, each with the list's name ("Caretaker's · on Autumn"), and
 * the open bars named like it. Near the last place this device was found
 * (store/useLastPlace.ts), else anywhere (`near` false). Nothing until two
 * letters are typed.
 */
export function useRankFindNear(typed: string) {
  const place = useLastPlace((s) => s.place);
  const area: Area = place ? nearMeArea(place) : { kind: 'anywhere' };
  const asked = typed.trim().length >= 2;
  const list = useDiscoverList({ kinds: [], search: typed, area }, { onNow: true, pageSize: NEAR_READ, enabled: asked, searchedOnly: true });
  const shown = asked ? namedFirst(list.drinks, typed).slice(0, NEAR_DRINKS) : [];
  const ids = shown.map((d) => d.id);
  const menus = useQuery({
    queryKey: ['rank-it-menus', ids],
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: () => drinkRuns(ids),
  });
  const bars = useDiscoverBars(area, { search: typed, onNow: true, searchedOnly: true }, asked);
  const onNow = menusOnNow(menus.data ?? []);
  // Only bars named like what's typed: discover_bars also counts bars that merely pour a matching drink.
  const named = asked ? findDrinks((bars.data ?? []).filter((b) => !b.closed), typed).slice(0, NEAR_BARS) : [];
  return {
    near: !!place,
    drinks: shown.map((d) => ({ ...d, menuName: onNow.get(`${d.id}:${d.barId}`) ?? null })),
    bars: named,
    // A bar leads only when no drink is called that: "negr" is the Negroni, "little rye" the bar.
    barsFirst: named.length > 0 && !findDrinks(shown, typed).length,
    isLoading: asked && (list.isLoading || bars.isPending),
    error: list.error ?? bars.error,
  };
}
