import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, Title, useDs } from '@/components/ds';
import { familyHues, fontFamilies, layout, radius, space } from '@/constants/tokens';
import { ERAS, fromLine, shortYear, type TimelineRow as Row, type TimelineSection } from '@/lib/timeline';

const YEAR_W = 52;
const SPINE_W = 20;

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
}: {
  row: Row;
  selected: boolean;
  inThread: boolean;
  dimmed: boolean;
  wide: boolean;
  onPress: () => void;
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
        <View style={[styles.line, { backgroundColor: inThread ? ds.accentText : ds.c.lineStrong }]} />
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
          <Caption tone="muted" numberOfLines={1}>
            {from}
          </Caption>
        ) : null}
      </View>
      {wide ? (
        <Caption tone="muted" style={styles.note} numberOfLines={3}>
          {style ? '' : (n.note ?? '')}
        </Caption>
      ) : null}
    </PressableScale>
  );
}

/** "1860 to 1919 · 123 drinks", the era's name and one line about it. Sticky above its rows. */
export function EraHeader({ section }: { section: TimelineSection }) {
  const ds = useDs();
  const i = ERAS.findIndex((e) => e.key === section.era.key);
  const next = ERAS[i + 1];
  const range = `${section.era.start} to ${next ? next.start - 1 : 'now'}`;
  return (
    <View style={[styles.era, { backgroundColor: ds.c.ground, borderBottomColor: ds.c.line }]}>
      <Caption tone="muted" style={styles.eyebrow}>{`${range} · ${section.drinks} drink${section.drinks === 1 ? '' : 's'}`}</Caption>
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
  dot: { width: 12, height: 12, borderRadius: radius.pill, marginTop: space.md + 3 },
  text: { flex: 1, minWidth: 0, gap: 2, paddingVertical: space.sm + 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  name: { fontFamily: fontFamilies.instrument },
  styleTag: { fontFamily: fontFamilies.mono, letterSpacing: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.mark, paddingHorizontal: space.xs + 2 },
  note: { flex: 1.1, minWidth: 0, paddingTop: space.md + 2, paddingRight: space.sm },
  era: { paddingTop: space.lg, paddingBottom: space.md, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
});
