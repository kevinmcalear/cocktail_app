import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, Spec, useBreakpoint, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useBarTopDrinks } from '@/hooks/useRankings';
import type { BarNews } from '@/lib/collectionMenus';
import { dayShort, type BeenBar, type WantBar } from '@/lib/collectionStages';
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

/** Been (board home-collection-bars, step 2): your score for the bar beside everyone's, drinks had, your best there, last time. */
export function BeenRow({ bar, loved, news, everyone, now }: { bar: BeenBar; loved: boolean; news: BarNews | null; everyone: number | null; now: number }) {
  const ds = useDs();
  const router = useRouter();
  const desk = useBreakpoint() === 'desktop';
  const v = bar.venue;
  const count = `${bar.drinks} ${bar.drinks === 1 ? 'drink' : 'drinks'}`;
  const last = bar.last ? dayShort(bar.last, now) : null;
  const label = [v.name, loved ? 'loved' : null, v.place, `your score ${formatScore(bar.yours)} over ${count}`, everyone !== null ? `everyone ${formatScore(everyone)}` : null, `best ${bar.best.name} ${formatScore(bar.best.score)}`, last ? `last ${last}` : null, news?.text]
    .filter(Boolean)
    .join('. ');
  const name = (
    <View style={styles.nameLine}>
      <DsText variant="headline" numberOfLines={1} style={styles.shrink}>
        {v.name}
      </DsText>
      {loved ? <IconSymbol name="heart.fill" size={13} color={ds.accentText} /> : null}
    </View>
  );
  if (desk) {
    return (
      <PressableScale role="link" accessibilityLabel={label} onPress={() => router.push(barHref(v))} style={[stageStyles.tableRow, { borderBottomColor: ds.c.line }]}>
        <View style={[stageStyles.grow, styles.bar]}>
          <BarMark name={v.name} logoUrl={v.avatarUrl} profileId={v.id} size={48} />
          <View style={stageStyles.grow}>
            {name}
            <Caption tone="muted" numberOfLines={1}>
              {v.place}
              {news ? <Caption color={ds.accentText}>{`${v.place ? ' · ' : ''}${news.text}`}</Caption> : null}
            </Caption>
          </View>
        </View>
        <Body style={styles.drinks}>{count}</Body>
        <Body numberOfLines={1} style={styles.best}>
          {bar.best.name} <Spec tone="muted">{formatScore(bar.best.score)}</Spec>
        </Body>
        <Body tone="muted" style={styles.last}>
          {last ?? ''}
        </Body>
        <Spec style={styles.num}>{formatScore(bar.yours)}</Spec>
        <Spec tone="muted" style={styles.numWide}>
          {everyone !== null ? formatScore(everyone) : ''}
        </Spec>
      </PressableScale>
    );
  }
  return (
    <PressableScale role="link" accessibilityLabel={label} onPress={() => router.push(barHref(v))} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <BarMark name={v.name} logoUrl={v.avatarUrl} profileId={v.id} size={52} />
      <View style={stageStyles.grow}>
        {name}
        <Caption tone="muted" numberOfLines={1}>
          {[count, last].filter(Boolean).join(' · ')}
        </Caption>
        <Caption numberOfLines={1}>
          Best: {bar.best.name} <Caption style={styles.mono}>{formatScore(bar.best.score)}</Caption>
        </Caption>
        {news ? (
          <Caption color={ds.accentText} numberOfLines={1}>
            {news.text}
          </Caption>
        ) : null}
      </View>
      <Score score={bar.yours} detail={everyone !== null ? `all ${formatScore(everyone)}` : null} />
    </PressableScale>
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
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  shrink: { flexShrink: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  score: { alignItems: 'flex-end', minWidth: 64 },
  mono: { fontVariant: ['tabular-nums'] },
  drinks: { width: 150 },
  best: { width: 220 },
  last: { width: 100 },
  num: { width: 70, textAlign: 'right' },
  numWide: { width: 80, textAlign: 'right' },
  away: { width: 90 },
  hours: { width: 150 },
  why: { width: 230 },
});
