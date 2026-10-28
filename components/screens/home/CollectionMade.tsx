import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, DsText, PressableScale, Spec, useBreakpoint, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { gapLabel, type MadeRow } from '@/lib/collectionStages';
import { itemHref } from '@/lib/itemRoutes';
import { formatScore } from '@/lib/ranking';

import { StageHead, TableHead, stageStyles } from './CollectionStages';

/** "Little Rye’s spec", "Classic", or nothing. */
const specOf = (r: MadeRow) => (r.barName ? `${r.barName}’s spec` : r.classic ? 'Classic' : null);
const timesOf = (n: number) => (n === 1 ? 'made once' : n === 2 ? 'made twice' : `made ${n} times`);
/** Where a score sits on the track, which runs 6 to 10 (below 6 sits at the start). */
const pct = (score: number) => Math.max(0, Math.min(100, ((score - 6) / 4) * 100));
const at = (score: number) => `${pct(score)}%` as const;

/** Your version (the dot) against your score for the bar's (the ring), on one line, with the stretch between lit. */
function Track({ you, bar }: { you: number | null; bar: number | null }) {
  const ds = useDs();
  const beat = you !== null && bar !== null && you > bar;
  const low = you !== null && bar !== null ? Math.min(you, bar) : null;
  return (
    <View aria-hidden style={[styles.track, { backgroundColor: ds.c.line }]}>
      {you !== null && bar !== null && low !== null ? (
        <View style={[styles.span, { left: at(low), width: `${Math.abs(pct(you) - pct(bar))}%`, backgroundColor: beat ? withAlpha(ds.accentText, 0.7) : ds.c.lineStrong }]} />
      ) : null}
      {bar !== null ? <View style={[styles.ring, { left: at(bar), borderColor: ds.accentText, backgroundColor: ds.c.ground }]} /> : null}
      {you !== null ? <View style={[styles.dot, { left: at(you), backgroundColor: ds.c.ink }]} /> : null}
    </View>
  );
}

/** The key to the track: the dot is yours, the ring the bar's. */
function Legend() {
  const ds = useDs();
  return (
    <View style={styles.legend} aria-hidden>
      <View style={styles.key}>
        <View style={[styles.keyDot, { backgroundColor: ds.c.ink }]} />
        <Caption tone="muted">Yours</Caption>
      </View>
      <View style={styles.key}>
        <View style={[styles.keyRing, { borderColor: ds.accentText }]} />
        <Caption tone="muted">Bar’s</Caption>
      </View>
    </View>
  );
}

/**
 * Made (board home-collection-drinks, step 3): each drink you made at home,
 * whose spec, how often, and your score for your version against your score
 * for the bar's, with the gap. Classics have no bar to beat.
 */
export function MadeAtHome({ rows }: { rows: MadeRow[] }) {
  const ds = useDs();
  const router = useRouter();
  const desk = useBreakpoint() === 'desktop';
  if (!rows.length) return <Body tone="muted">Tap I made it on a drink’s page after you make it at home. It lands here, against the bar’s.</Body>;
  const gapOf = (r: MadeRow) => (r.you !== null && r.bar !== null ? gapLabel(r.you, r.bar) : null);
  const beat = (r: MadeRow) => r.you !== null && r.bar !== null && r.you > r.bar;
  const label = (r: MadeRow) =>
    [r.tally.name, specOf(r), timesOf(r.tally.times), r.you !== null ? `yours ${formatScore(r.you)}` : null, r.bar !== null ? `the bar’s ${formatScore(r.bar)}, ${gapOf(r)}` : r.classic ? 'a classic' : null].filter(Boolean).join('. ');
  const open = (r: MadeRow) => router.push(itemHref('Cocktail', r.tally.itemId) as never);
  return (
    <View style={stageStyles.section}>
      <StageHead title="Made at home">
        <Legend />
      </StageHead>
      {desk ? (
        <View role="table" aria-label="Drinks you made at home">
          <TableHead
            cols={[
              { label: 'Drink', width: null },
              { label: 'Whose spec', width: 170 },
              { label: 'Made', width: 110 },
              { label: 'Yours against the bar’s', width: 220 },
              { label: 'Yours', width: 56, end: true },
              { label: 'Bar', width: 56, end: true },
              { label: 'Gap', width: 70, end: true },
            ]}
          />
          {rows.map((r) => (
            <PressableScale key={r.tally.itemId} role="link" accessibilityLabel={label(r)} onPress={() => open(r)} style={[stageStyles.tableRow, { borderBottomColor: ds.c.line }]}>
              <View style={[stageStyles.grow, styles.drink]}>
                <DrinkImage source={r.tally.imageUrl} itemId={r.tally.itemId} accessibilityLabel={r.tally.name} radius="control" aspectRatio={1} style={styles.thumb} />
                <DsText variant="headline" numberOfLines={1} style={stageStyles.grow}>
                  {r.tally.name}
                </DsText>
              </View>
              <Body numberOfLines={1} style={styles.spec}>
                {specOf(r) ?? ''}
              </Body>
              <Body tone="muted" style={styles.times}>
                {timesOf(r.tally.times)}
              </Body>
              <View style={styles.trackCell}>{r.you !== null || r.bar !== null ? <Track you={r.you} bar={r.bar} /> : null}</View>
              <Spec style={styles.num}>{r.you !== null ? formatScore(r.you) : ''}</Spec>
              <Spec tone="muted" style={styles.num}>
                {r.bar !== null ? formatScore(r.bar) : ''}
              </Spec>
              <View style={styles.gapCell}>
                <View style={[styles.gap, { backgroundColor: beat(r) ? withAlpha(ds.accentText, 0.16) : ds.c.line }]}>
                  <Caption tone={beat(r) ? 'accent' : 'muted'} style={styles.mono}>
                    {gapOf(r) ?? (r.classic ? 'classic' : '')}
                  </Caption>
                </View>
              </View>
            </PressableScale>
          ))}
        </View>
      ) : (
        <View role="list">
          {rows.map((r) => (
            <View role="listitem" key={r.tally.itemId}>
              <DrinkRow
                compact
                name={r.tally.name}
                itemId={r.tally.itemId}
                onPress={() => open(r)}
                imageUrl={r.tally.imageUrl}
                glass={null}
                caption={[specOf(r), timesOf(r.tally.times)].filter(Boolean).join(' · ')}
                below={r.you !== null || r.bar !== null ? <Track you={r.you} bar={r.bar} /> : undefined}
                trailing={
                  <View style={styles.trailing}>
                    <Spec>{r.you !== null ? formatScore(r.you) : ''}</Spec>
                    <Caption tone={beat(r) ? 'accent' : 'muted'} style={styles.mono}>
                      {gapOf(r) ? `${gapOf(r)} bar` : r.classic ? 'classic' : ''}
                    </Caption>
                  </View>
                }
                label={label(r)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, borderRadius: radius.pill, marginTop: space.sm, marginHorizontal: 7, marginBottom: space.xs },
  span: { position: 'absolute', top: 0, height: 4 },
  ring: { position: 'absolute', top: -5, width: 14, height: 14, marginLeft: -7, borderRadius: radius.pill, borderWidth: 2 },
  dot: { position: 'absolute', top: -4, width: 12, height: 12, marginLeft: -6, borderRadius: radius.pill },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  key: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  keyDot: { width: 9, height: 9, borderRadius: radius.pill },
  keyRing: { width: 10, height: 10, borderRadius: radius.pill, borderWidth: 2 },
  drink: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 48, height: 48 },
  spec: { width: 170 },
  times: { width: 110 },
  trackCell: { width: 220 },
  num: { width: 56, textAlign: 'right' },
  gapCell: { width: 70, alignItems: 'flex-end' },
  gap: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
  mono: { fontFamily: fontFamilies.mono, fontVariant: ['tabular-nums'] },
  trailing: { alignItems: 'flex-end', minWidth: 64 },
});
