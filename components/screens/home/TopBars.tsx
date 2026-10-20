import { StyleSheet, View } from 'react-native';

import { Caption, Headline } from '@/components/ds';
import { FirstOpenSheet } from '@/components/screens/home/FirstOpenSheet';
import { AreaRankList, EarlyList, ListNote } from '@/components/screens/rankings/RankingLists';
import { BarResultRow } from '@/components/search/ResultRows';
import { space } from '@/constants/tokens';
import { useTopBars } from '@/hooks/useDiscover';
import { useDiscoverBars } from '@/hooks/useDiscoverDrinks';
import type { DiscoverBar } from '@/lib/discoverDrinks';
import { areaLabel, earlyNote, type Area } from '@/lib/nearMe';
import { MIN_RANKERS } from '@/lib/ranking';

const TOP = 5;

/** Bars the search actually hits, most matches first. */
function matching(bars: readonly DiscoverBar[]): DiscoverBar[] {
  return bars.filter((b) => b.drinks > 0 && !b.closed).sort((a, b) => b.drinks - a.drinks || a.name.localeCompare(b.name));
}

/**
 * "Top bars near you", by bar score: the average of a bar's drink scores,
 * weighted by how many people ranked each (see the discover migration).
 * Early bars (fewer than MIN_RANKERS people, or nobody yet) are listed
 * without a score when no bar has one yet: the viewer's loved bars first,
 * then the most relevant (discover_top_bars). Each row has its heart.
 * While a search is typed, this section is the bars that match it instead.
 */
export function TopBars({ area, search = '', kinds = [], onShowBar }: { area: Area; search?: string; kinds?: readonly string[]; /** Hovering a row opens that bar on the map. */ onShowBar?: (barId: string | null) => void }) {
  const q = search.trim();
  const where = areaLabel(area);
  const { data, isLoading, error } = useTopBars(area, !q);
  const found = useDiscoverBars(area, { search: q, kinds }, !!q);
  if (q) {
    const bars = matching(found.data ?? []);
    return (
      <View style={styles.section}>
        <Caption tone="muted">{`Matching “${q}”`}</Caption>
        <Headline role="heading">{`Bars ${where}`}</Headline>
        {found.isLoading ? <ListNote>Loading…</ListNote> : bars.length ? bars.map((b) => <BarResultRow key={b.id} bar={b} query={q} onShowBar={onShowBar} />) : <ListNote>{`No bars ${where} match “${q}”.`}</ListNote>}
      </View>
    );
  }
  // The top five, as drawn (disc-list); the full list is the rankings page.
  const ranked = (data?.ranked ?? []).slice(0, TOP);
  const early = (data?.early ?? []).slice(0, TOP);

  let body;
  if (error) body = <ListNote>{`Couldn't load the bars: ${error.message}`}</ListNote>;
  else if (isLoading) body = <ListNote>Loading…</ListNote>;
  else if (ranked.length) {
    body = <AreaRankList rows={ranked} scoreDetail={(r) => `${r.rankers} ranked`} love onShowBar={onShowBar} />;
  } else if (early.length) {
    body = (
      <>
        <ListNote>{earlyNote(early, MIN_RANKERS)}</ListNote>
        <EarlyList rows={early} love onShowBar={onShowBar} />
      </>
    );
  } else body = <ListNote>{`No bars ${where} on Cocktail yet.`}</ListNote>;

  return (
    <View style={styles.section}>
      <Caption tone="muted">{early.some((r) => r.rankers > 0) && !ranked.length ? 'Early' : early.length || ranked.length || isLoading ? 'Bar score, from every drink ranked there' : 'No bars yet'}</Caption>
      <Headline role="heading">{`Top bars ${where}`}</Headline>
      {body}
      {/* The first time someone opens Discover, these same bars ask to be loved or hidden (disc-first-open). */}
      <FirstOpenSheet area={area} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs, marginTop: space.xl },
});
