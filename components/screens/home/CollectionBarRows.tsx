import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, Spec, useBreakpoint, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBarTopDrinks } from '@/hooks/useRankings';
import type { WantBar } from '@/lib/collectionStages';
import { formatScore } from '@/lib/ranking';

import { BarMark } from './BarMark';
import { stageStyles } from './CollectionStages';

const barHref = (b: { id: string; handle: string | null }) => `/p/${b.handle || b.id}` as Href;

/** The score column: yours (or everyone's) in mono, with a muted word under it. */
function Score({ score, detail }: { score: number | null; detail: string | null }) {
  return (
    <View style={styles.score}>
      <Spec>{score !== null ? formatScore(score) : ''}</Spec>
      {detail ? <Caption tone="muted">{detail}</Caption> : null}
    </View>
  );
}

/**
 * "Their best: Night Garden Sour", on a desktop: the bar's top-ranked drink.
 * ponytail: one query per row, fine for the dozens of bars someone loves.
 * Upgrade path: return the top drink from a batched bar query.
 */
function TheirBest({ id }: { id: string }) {
  const top = (useBarTopDrinks(id, 1).data ?? [])[0];
  return top ? (
    <Caption tone="muted" numberOfLines={1}>
      Their best: {top.name}
    </Caption>
  ) : null;
}

/** Want to go (board home-collection-bars, step 1): how far, open tonight or not, why it's here, everyone's score. `compact`: the phone row on any screen (the map's list pane, step 3). */
export function WantRow({ bar, compact = false }: { bar: WantBar; compact?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const desk = useBreakpoint() === 'desktop' && !compact;
  const hoursColor = bar.hours?.open ? ds.accentText : ds.c.muted;
  const label = [bar.name, bar.away ?? bar.place, bar.hours?.text, bar.why, bar.everyone !== null ? `everyone ${formatScore(bar.everyone)}` : null].filter(Boolean).join('. ');
  if (desk) {
    return (
      <PressableScale role="link" accessibilityLabel={label} onPress={() => router.push(barHref(bar))} style={[stageStyles.tableRow, { borderBottomColor: ds.c.line }]}>
        <View style={[stageStyles.grow, styles.bar]}>
          <BarMark name={bar.name} logoUrl={bar.avatarUrl} profileId={bar.id} size={48} />
          <View style={stageStyles.grow}>
            <DsText variant="headline" numberOfLines={1}>
              {bar.name}
            </DsText>
            <TheirBest id={bar.id} />
          </View>
        </View>
        <Body style={styles.away}>{bar.away ?? bar.place ?? ''}</Body>
        <Body color={hoursColor} numberOfLines={1} style={styles.hours}>
          {bar.hours?.text ?? ''}
        </Body>
        <Body numberOfLines={1} style={styles.why}>
          {bar.why ?? ''}
        </Body>
        <Spec style={styles.numWide}>{bar.everyone !== null ? formatScore(bar.everyone) : ''}</Spec>
      </PressableScale>
    );
  }
  return (
    <PressableScale role="link" accessibilityLabel={label} onPress={() => router.push(barHref(bar))} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <BarMark name={bar.name} logoUrl={bar.avatarUrl} profileId={bar.id} size={52} />
      <View style={stageStyles.grow}>
        <DsText variant="headline" numberOfLines={1}>
          {bar.name}
        </DsText>
        <Caption tone="muted" numberOfLines={1}>
          {bar.away ?? bar.place}
          {bar.hours ? <Caption color={hoursColor}>{`${bar.away ?? bar.place ? ' · ' : ''}${bar.hours.text}`}</Caption> : null}
        </Caption>
        {bar.why ? <Caption numberOfLines={1}>{bar.why}</Caption> : null}
      </View>
      {bar.everyone !== null ? <Score score={bar.everyone} detail="everyone" /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  score: { alignItems: 'flex-end', minWidth: 64 },
  numWide: { width: 80, textAlign: 'right' },
  away: { width: 90 },
  hours: { width: 150 },
  why: { width: 230 },
});
