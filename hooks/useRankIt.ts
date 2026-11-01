import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { useLovedBars } from '@/hooks/useKept';
import { HAD_COLUMNS, withPublishedItems } from '@/hooks/useRankings';
import { toHadDrink, type HadDrink, type HadRow } from '@/lib/hadDrinks';
import { localDate } from '@/lib/ranking';
import { pickSuggestion, tonightEntry, type DrinkRun, type RankSuggestion, type WantedDrink } from '@/lib/rankIt';
import { supabase } from '@/lib/supabase';

/**
 * Home Tonight's "Had a drink? Rank it" (Loop-rank board): the suggested
 * drink and tonight's ranking. The picking is in lib/rankIt.ts; what the
 * sheet finds is in hooks/useRankFind.ts, which loads with the sheet.
 */

/** How many of your newest wants the suggestion looks through. */
const WANTS_READ = 50;

/** The menus these drinks are on (drink_list_dates), as plain rows. */
export async function drinkRuns(ids: string[]): Promise<DrinkRun[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.rpc('drink_list_dates', { p_item_ids: ids });
  if (error) throw error;
  return (data ?? []).map((r) => ({ item_id: r.item_id, profile_id: r.profile_id, edition_name: r.edition_name, is_current: r.is_current }));
}

/** What the suggestion is picked from: your newest wants not yet had, the menus they're on, and those bars' names. Plain JSON. */
interface SuggestionData {
  wants: WantedDrink[];
  runs: DrinkRun[];
  barNames: [string, string][];
}

/**
 * The drink the row under "What did you have?" suggests: one on your Want
 * list that you haven't had (a want is done once it's in drinks_had) and
 * that's on a list on now, at a bar you love first (lib/rankIt
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
      const wanted = (rows ?? []).flatMap((r) => (r.item_id && r.name ? [{ itemId: r.item_id, name: r.name, barName: r.bar_name }] : []));
      const ids = wanted.map((w) => w.itemId);
      const [allRuns, had] = await Promise.all([drinkRuns(ids), ids.length ? supabase.from('drinks_had').select('item_id').eq('user_id', userId!).in('item_id', ids) : Promise.resolve({ data: [], error: null })]);
      if (had.error) throw had.error;
      const done = new Set((had.data ?? []).map((h) => h.item_id));
      const runs = allRuns.filter((r) => r.is_current && !done.has(r.item_id));
      const bars = runs.length ? await supabase.from('profiles').select('id, display_name').in('id', [...new Set(runs.map((r) => r.profile_id))]) : { data: [], error: null };
      if (bars.error) throw bars.error;
      return {
        wants: wanted.filter((w) => !done.has(w.itemId)),
        runs,
        barNames: (bars.data ?? []).map((b) => [b.id as string, b.display_name as string]),
      };
    },
  });
  if (!data) return null;
  return pickSuggestion(data.wants, data.runs, new Set((loved ?? []).map((b) => b.id)), new Map(data.barNames));
}

/**
 * Your ranking tonight, for the row that replaces the suggestion ("Caretaker's
 * · tonight", 9.0) and "Ranked. Had another?". Under 'my-had', so ranking
 * refreshes it. Null when you've ranked nothing tonight.
 */
export function useRankedTonight(): HadDrink | null {
  const userId = useUserId();
  const { data } = useQuery({
    queryKey: ['my-had', userId, 'tonight'],
    enabled: !!userId,
    queryFn: async (): Promise<HadDrink[]> => {
      // Yesterday's and today's: lib/rankIt tonightEntry picks tonight's on the phone's own clock.
      const since = new Date(Date.now() - 36 * 3_600_000);
      const { data: rows, error } = await supabase
        .from('rank_entry_scores')
        .select(HAD_COLUMNS)
        .eq('user_id', userId!)
        .or(`had_on.gte.${localDate(since)},created_at.gte."${since.toISOString()}"`)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (await withPublishedItems((rows ?? []) as HadRow[])).map(toHadDrink);
    },
  });
  const now = new Date();
  return tonightEntry(data ?? [], now, localDate(now));
}
