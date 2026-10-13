import { StyleSheet, View } from 'react-native';

import { Caption, Headline } from '@/components/ds';
import { AreaRankList, EarlyList, ListNote } from '@/components/screens/rankings/RankingLists';
import { space } from '@/constants/tokens';
import { useTopBars } from '@/hooks/useDiscover';
import { areaLabel, earlyNote, type Area } from '@/lib/nearMe';
import { MIN_RANKERS } from '@/lib/ranking';

const TOP = 5;

/**
 * "Top bars near you", by bar score: the average of a bar's drink scores,
 * weighted by how many people ranked each (see the discover migration).
 * Early bars (fewer than MIN_RANKERS people, or nobody yet) are listed
 * without a score when no bar has one yet.
 */
export function TopBars({ area }: { area: Area }) {
  const where = areaLabel(area);
  const { data, isLoading, error } = useTopBars(area);
  // The top five, as drawn (disc-list); the full list is the rankings page.
  const ranked = (data?.ranked ?? []).slice(0, TOP);
  const early = (data?.early ?? []).slice(0, TOP);

  let body;
  if (error) body = <ListNote>{`Couldn't load the bars: ${error.message}`}</ListNote>;
  else if (isLoading) body = <ListNote>Loading…</ListNote>;
  else if (ranked.length) {
    body = <AreaRankList rows={ranked} scoreDetail={(r) => `${r.rankers} ranked`} />;
  } else if (early.length) {
    body = (
      <>
        <ListNote>{earlyNote(early, MIN_RANKERS)}</ListNote>
        <EarlyList rows={early} />
      </>
    );
  } else body = <ListNote>{`No bars ${where} on Cocktail yet.`}</ListNote>;

  return (
    <View style={styles.section}>
      <Caption tone="muted">{ranked.length || isLoading ? 'Bar score, from every drink ranked there' : early.some((r) => r.rankers > 0) ? 'Early' : early.length ? 'Not ranked yet' : 'No bars yet'}</Caption>
      <Headline role="heading">{`Top bars ${where}`}</Headline>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs, marginTop: space.xl },
});
