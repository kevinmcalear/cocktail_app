import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, DsText, PressableScale, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { familyHues, fontFamilies, layout, radius, space } from '@/constants/tokens';
import { ERAS, fromLine, shortYear, type TimelineRow as Row, type TimelineSection } from '@/lib/timeline';

const YEAR_W = 52;
const SPINE_W = 20;
const TILE = 44;
const TILE_WIDE = 36;

/** The family's hue for this scheme; Punch and unknown families get the trunk's. */
export function useFamilyHue(family: string): string {
  const hues = familyHues[useDs().scheme];
  return hues[family as keyof typeof hues] ?? hues.trunk;
}

/** "Jerry Thomas · El Dorado (closed)". */
export function makerLine(n: Row['node']): string {
  return [n.creator, n.bar ? `${n.bar}${n.barClosed ? ' (closed)' : ''}` : null].filter(Boolean).join(' · ');
}

/**
 * One drink or historic style on the timeline: its year, a dot on the spine
 * in its family's hue (a ring for a style), its name, who made it where, and
 * what it came from. Wide layouts add what changed. In thread mode the
 * drinks off the thread fade back.
 */
export function TimelineRowView({
  row,
  selected,
  inThread,
  dimmed,
  wide,
  onPress,
  threadSpine = null,
}: {
  row: Row;
  selected: boolean;
  inThread: boolean;
  dimmed: boolean;
  wide: boolean;
  onPress: () => void;
  /** Where the thread's accent line runs through this row's spine: from its dot down, up to it, or right through. */
  threadSpine?: 'down' | 'up' | 'through' | null;
}) {
  const ds = useDs();
  const hue = useFamilyHue(row.node.family);
  const n = row.node;
  const style = n.kind === 'style';
  const maker = makerLine(n);
  const from = fromLine(row);
  const year = shortYear(n);
  const label = [n.approx ? `About ${n.year}` : String(n.year), n.name, style ? 'historic style' : null, maker, from, selected ? 'selected' : null]
    .filter(Boolean)
    .join(', ');
  return (
    <PressableScale
      role="button"
      accessibilityLabel={label}
      aria-selected={selected}
      onPress={onPress}
      style={[styles.row, { opacity: dimmed ? 0.38 : 1 }, selected ? { backgroundColor: ds.c.raised } : null]}
    >
      <View style={styles.year}>
        {row.newYear ? (
          <Caption tone={selected || inThread ? 'ink' : 'muted'} style={styles.mono}>
            {year}
          </Caption>
        ) : null}
      </View>
      <View style={styles.spine}>
        <View style={[styles.line, { backgroundColor: ds.c.lineStrong }]} />
        {threadSpine ? (
          <View style={[styles.line, threadSpine === 'down' ? styles.lower : threadSpine === 'up' ? styles.upper : null, { backgroundColor: ds.accentText }]} />
        ) : null}
        <View
          style={[
            styles.dot,
            style
              ? { backgroundColor: ds.c.ground, borderColor: hue, borderWidth: 2 }
              : { backgroundColor: selected ? ds.accentText : hue },
            selected || inThread ? { borderColor: ds.accentText, borderWidth: 2 } : null,
          ]}
        />
      </View>
      <View style={styles.text}>
        <View style={styles.nameLine}>
          <DsText variant="headline" style={styles.name} color={selected ? ds.accentText : undefined} numberOfLines={2}>
            {n.name}
          </DsText>
          {style ? <Caption tone="muted" style={[styles.styleTag, { borderColor: ds.c.lineStrong }]}>STYLE</Caption> : null}
        </View>
        {maker ? (
          <Caption tone="muted" numberOfLines={1}>
            {maker}
          </Caption>
        ) : null}
        {style && n.note ? (
          <Caption tone="muted" numberOfLines={2}>
            {n.note}
          </Caption>
        ) : null}
        {from ? (
          <View style={styles.from}>
            <IconSymbol name="arrow.uturn.backward" size={13} color={ds.c.muted} />
            <Caption tone="muted" numberOfLines={1} style={styles.flex}>
              {from}
            </Caption>
          </View>
        ) : null}
      </View>
      {wide ? (
        <Caption tone="muted" style={styles.note} numberOfLines={3}>
          {style ? '' : (n.note ?? '')}
        </Caption>
      ) : null}
      {/* Rows carry year, maker and a sketch tile; styles are words only (board prep-hist-timeline-phone). */}
      {style ? null : (
        <View style={[styles.tile, { width: wide ? TILE_WIDE : TILE, height: wide ? TILE_WIDE : TILE }]} aria-hidden>
          <DrinkImage thumb sketchDetail="thumb" itemId={n.id} glass={null} accessibilityLabel={n.name} radius="control" />
        </View>
      )}
    </PressableScale>
  );
}

/** "1860 to 1919 · 123 drinks", the era's name and one line about it. Sticky above its rows. */
export function EraHeader({ section, wide }: { section: TimelineSection; wide?: boolean }) {
  const ds = useDs();
  const i = ERAS.findIndex((e) => e.key === section.era.key);
  const next = ERAS[i + 1];
  const range = `${section.era.start} to ${next ? next.start - 1 : 'now'}`;
  const count = `${range} · ${section.drinks} drink${section.drinks === 1 ? '' : 's'}`;
  // Desktop: the era's name with its range beside it, one line (board prep-hist-timeline-desktop).
  if (wide) {
    return (
      <View style={[styles.era, styles.eraWide, { backgroundColor: ds.c.ground, borderBottomColor: ds.c.line }]}>
        <Title>{section.era.name}</Title>
        <Caption tone="muted" style={styles.eyebrow}>
          {count}
        </Caption>
      </View>
    );
  }
  return (
    <View style={[styles.era, { backgroundColor: ds.c.ground, borderBottomColor: ds.c.line }]}>
      <Caption tone="muted" style={styles.eyebrow}>{count}</Caption>
      <Title>{section.era.name}</Title>
      <Caption tone="muted">{section.era.blurb}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: layout.minTapTarget + space.lg, borderRadius: radius.control, borderCurve: 'continuous', columnGap: space.sm },
  year: { width: YEAR_W, paddingTop: space.md + 2 },
  mono: { fontFamily: fontFamilies.mono, fontVariant: ['tabular-nums'] },
  spine: { width: SPINE_W, alignItems: 'center' },
  line: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  // The thread's line starts or stops at the dot.
  lower: { top: space.md + 9 },
  upper: { bottom: undefined, height: space.md + 9 },
  from: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  flex: { flex: 1, minWidth: 0 },
  tile: { marginTop: space.sm + 2, marginLeft: space.sm },
  dot: { width: 12, height: 12, borderRadius: radius.pill, marginTop: space.md + 3 },
  text: { flex: 1, minWidth: 0, gap: 2, paddingVertical: space.sm + 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  name: { fontFamily: fontFamilies.instrument },
  styleTag: { fontFamily: fontFamilies.mono, letterSpacing: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.mark, paddingHorizontal: space.xs + 2 },
  note: { flex: 1.1, minWidth: 0, paddingTop: space.md + 2, paddingRight: space.sm },
  era: { paddingTop: space.lg, paddingBottom: space.md, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  eraWide: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, paddingHorizontal: space.sm },
});
