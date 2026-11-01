import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { useDiscoverBars, useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { useLovedBars } from '@/hooks/useKept';
import { fetchPublished } from '@/hooks/usePublished';
import { withPublishedItems } from '@/hooks/useRankings';
import { findDrinks } from '@/lib/discover';
import type { ItemImageLink } from '@/lib/itemImages';
import { nearMeArea, type Area } from '@/lib/nearMe';
import { localDate } from '@/lib/ranking';
import { menusOnNow, namedFirst, pickSuggestion, tonightEntry, type DrinkRun, type RankedEntry, type RankSuggestion, type WantedDrink } from '@/lib/rankIt';
import { supabase } from '@/lib/supabase';
import { useLastPlace } from '@/store/useLastPlace';

/**
 * Home Tonight's "Had a drink? Rank it" (Loop-rank board): the suggested
 * drink, tonight's ranking, and what the Rank it sheet finds near you.
 * The picking is in lib/rankIt.ts.
 */

/** How many of your newest wants the suggestion looks through. */
const WANTS_READ = 50;

/** The menus these drinks are on (drink_list_dates), as plain rows. */
async function drinkRuns(ids: string[]): Promise<DrinkRun[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.rpc('drink_list_dates', { p_item_ids: ids });
  if (error) throw error;
  return (data ?? []).map((r) => ({ item_id: r.item_id, profile_id: r.profile_id, edition_name: r.edition_name, is_current: r.is_current }));
}

/** What the suggestion is picked from: your newest wants, the menus they're on, and those bars' names. Plain JSON. */
interface SuggestionData {
  wants: WantedDrink[];
  runs: DrinkRun[];
  barNames: [string, string][];
}

/**
 * The drink the row under "What did you have?" suggests: one on your Want
 * list that's on a list on now, at a bar you love first (lib/rankIt
 * pickSuggestion). Null when none is, or signed out.
 */
export function useRankSuggestion(): RankSuggestion | null {
  const userId = useUserId();
  const loved = useLovedBars().data;
  const { data } = useQuery({
    queryKey: ['rank-it-suggestion', userId],
    enabled: !!userId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<SuggestionData> => {
      const { data: rows, error } = await supabase
        .from('want_list')
        .select('item_id, name, bar_name')
        .eq('user_id', userId!)
        .eq('kind', 'drink')
        .not('item_id', 'is', null)
        .order('wanted_at', { ascending: false })
        .limit(WANTS_READ);
      if (error) throw error;
      const wanted = (rows ?? []).flatMap((r) => (r.item_id ? [{ itemId: r.item_id, name: r.name, barName: r.bar_name }] : []));
      const runs = (await drinkRuns(wanted.map((w) => w.itemId))).filter((r) => r.is_current);
      const onNow = new Set(runs.map((r) => r.item_id));
      const shown = wanted.filter((w) => onNow.has(w.itemId));
      // A want keeps the name it was saved with; older ones without it take the drink's name now.
      const unnamed = shown.filter((w) => !w.name).map((w) => w.itemId);
      const [published, bars] = await Promise.all([
        fetchPublished(unnamed),
        runs.length ? supabase.from('profiles').select('id, display_name').in('id', [...new Set(runs.map((r) => r.profile_id))]) : Promise.resolve({ data: [], error: null }),
      ]);
      if (bars.error) throw bars.error;
      const names = new Map(published.map((p) => [p.id, p.name]));
      return {
        wants: shown.flatMap((w) => {
          const name = w.name ?? names.get(w.itemId);
          return name ? [{ itemId: w.itemId, name, barName: w.barName }] : [];
        }),
        runs,
        barNames: (bars.data ?? []).map((b) => [b.id as string, b.display_name as string]),
      };
    },
  });
  if (!data) return null;
  return pickSuggestion(data.wants, data.runs, new Set((loved ?? []).map((b) => b.id)), new Map(data.barNames));
}

interface TonightRow {
  item_id: string;
  had_on: string | null;
  created_at: string;
  score: number | string;
  item: { name: string; item_images: ItemImageLink[] | null } | null;
  list: { name: string } | null;
  venue: { display_name: string } | null;
}

/**
 * Your ranking tonight, for the row that replaces the suggestion ("Caretaker's
 * · tonight", 9.0) and "Ranked. Had another?". Under 'my-had', so ranking
 * refreshes it. Null when you've ranked nothing tonight.
 */
export function useRankedTonight(): RankedEntry | null {
  const userId = useUserId();
  const { data } = useQuery({
    queryKey: ['my-had', userId, 'tonight'],
    enabled: !!userId,
    queryFn: async (): Promise<RankedEntry[]> => {
      // Yesterday's and today's: lib/rankIt tonightEntry picks tonight's on the phone's own clock.
      const since = new Date(Date.now() - 36 * 3_600_000);
      const { data: rows, error } = await supabase
        .from('rank_entry_scores')
        .select('item_id, had_on, created_at, score, item:items!item_id ( name, item_images ( angle, sort_order, is_generated, images ( url ) ) ), list:items!ranked_as_item_id ( name ), venue:profiles!venue_profile_id ( display_name )')
        .eq('user_id', userId!)
        .or(`had_on.gte.${localDate(since)},created_at.gte."${since.toISOString()}"`)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (await withPublishedItems((rows ?? []) as TonightRow[])).map((r) => ({
        itemId: r.item_id,
        name: r.item?.name ?? r.list?.name ?? 'A drink',
        score: Number(r.score),
        hadOn: r.had_on,
        createdAt: r.created_at,
        venueName: r.venue?.display_name ?? null,
      }));
    },
  });
  const now = new Date();
  return tonightEntry(data ?? [], now, localDate(now));
}

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
  const list = useDiscoverList({ kinds: [], search: typed, area }, { onNow: true, pageSize: NEAR_READ, enabled: asked });
  const shown = asked ? namedFirst(list.drinks, typed).slice(0, NEAR_DRINKS) : [];
  const ids = shown.map((d) => d.id);
  const menus = useQuery({
    queryKey: ['rank-it-menus', ids],
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: () => drinkRuns(ids),
  });
  const bars = useDiscoverBars(area, { search: typed, onNow: true }, asked);
  const onNow = menusOnNow(menus.data ?? []);
  return {
    near: !!place,
    drinks: shown.map((d) => ({ ...d, menuName: onNow.get(`${d.id}:${d.barId}`) ?? null })),
    // Only bars named like what's typed: discover_bars also counts bars that merely pour a matching drink.
    bars: asked ? findDrinks((bars.data ?? []).filter((b) => !b.closed), typed).slice(0, NEAR_BARS) : [],
    isLoading: asked && (list.isLoading || bars.isPending),
    error: list.error ?? bars.error,
  };
}
