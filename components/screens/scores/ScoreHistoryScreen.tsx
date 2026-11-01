import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, DrinkImage, useDs } from '@/components/ds';
import { CardGroup, CardRow } from '@/components/screens/rankings/ScoreRows';
import { CouldNotLoad } from '@/components/screens/safety/NotAvailable';
import { space } from '@/constants/tokens';
import { useDrinkScore } from '@/hooks/useScores';
import { formatScore } from '@/lib/ranking';
import { monthMarks, num, previousLine, scoreFromLine, versionMark } from '@/lib/scores';

import { BigScore, Meter, ScorePage, Sparkline } from './ScoreParts';

/**
 * A bar drink's score (Red-score "scorehist"): the score, what it's from and
 * six months of it. After a spec change, the new spec's score with the old
 * one linked under it. Below the floor, how many people so far.
 */
export function ScoreHistoryScreen({ itemId }: { itemId: string }) {
  return (
    <BackbarTheme>
      <ScoreHistory itemId={itemId} />
    </BackbarTheme>
  );
}

function ScoreHistory({ itemId }: { itemId: string }) {
  const ds = useDs();
  const router = useRouter();
  const { data: s, isLoading, error, refetch } = useDrinkScore(itemId);
  if (error) return <CouldNotLoad what="rankings" failed={{ retry: () => void refetch() }} />;
  if (isLoading) {
    return (
      <ScorePage title="Score">
        <ActivityIndicator color={ds.c.muted} />
      </ScorePage>
    );
  }
  if (!s) {
    return (
      <ScorePage title="Score">
        <Body tone="muted">Only a drink on a bar’s public page has a score.</Body>
      </ScorePage>
    );
  }
  const title = `${s.name}’s score`;
  const score = num(s.score);
  if (score == null) {
    return (
      <ScorePage eyebrow={s.bar_name} title={title}>
        <View style={styles.drawing}>
          <DrinkImage itemId={itemId} accessibilityLabel="" style={styles.glass} sketchDetail="thumb" />
        </View>
        <Body tone="muted" style={styles.center}>
          {`Not enough rankers yet at ${s.bar_name}. Its score shows here once ${s.floor} people have ranked it.`}
        </Body>
        <Meter
          rows={[
            { label: 'So far', n: s.rankers },
            { label: 'Needed', n: s.floor },
          ]}
        />
      </ScorePage>
    );
  }
  const points = s.history.map((h) => Number(h.score));
  const split = s.previous ? versionMark(s.history) : null;
  const marks = split ? [{ index: split, label: `Version ${s.version}` }] : monthMarks(s.history);
  return (
    <ScorePage eyebrow={[s.bar_name, s.version ? `version ${s.version}` : null].filter(Boolean).join(' · ')} title={title}>
      <BigScore score={formatScore(score)} sub={scoreFromLine(s)} />
      {points.length > 1 ? <Sparkline points={points} marks={marks} splitAt={split} label={`${s.name}’s score by month: ${points.map((p) => formatScore(p)).join(', ')}`} /> : null}
      {s.previous ? (
        <>
          <CardGroup>
            <CardRow icon="link" title="The score before this spec" sub={previousLine(s.previous)} value={formatScore(Number(s.previous.score))} />
          </CardGroup>
          <Body tone="muted">A new spec starts a new score. The old one stays linked here.</Body>
        </>
      ) : (
        <CardGroup>
          <CardRow title="Ranks in the last 180 days" sub={s.recent != null ? `${s.recent} people` : undefined} value="Count in full" />
          <CardRow title="Older ranks" sub={s.older != null ? `${s.older} people` : undefined} value="Count half" />
          <CardRow icon="book" title="How scores work" onPress={() => router.push('/how-scores-work')} />
        </CardGroup>
      )}
    </ScorePage>
  );
}

const styles = StyleSheet.create({
  drawing: { alignItems: 'center', paddingVertical: space.md },
  glass: { width: 130, height: 170 },
  center: { textAlign: 'center' },
});
