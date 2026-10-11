import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, PressableScale, Segmented, useDs } from '@/components/ds';
import { familyHues, layout, radius, space } from '@/constants/tokens';
import type { AxisFamily } from '@/lib/timeTree';

const SHOW = [
  { value: 'all', label: 'All' },
  { value: 'modern', label: 'Modern classics' },
] as const;

/**
 * Above the time-axis tree: All or Modern classics, a chip per family (its
 * colour and count) that jumps down to it, and the key to the marks.
 */
export function TreeControls({
  families,
  modernOnly,
  onModernOnly,
  onFamily,
  wide,
}: {
  families: AxisFamily[];
  modernOnly: boolean;
  onModernOnly: (on: boolean) => void;
  onFamily: (key: string) => void;
  wide: boolean;
}) {
  const ds = useDs();
  const hues = familyHues[ds.scheme];
  const hueOf = (family: string) => hues[family as keyof typeof hues] ?? hues.trunk;
  const chips = families.filter((f) => f.key !== 'trunk');
  const dot = (style: object) => <View style={[styles.mark, style]} />;
  return (
    <View style={styles.wrap}>
      <View style={wide ? styles.show : null}>
        <Segmented accessibilityLabel="Show" options={SHOW} value={modernOnly ? 'modern' : 'all'} onChange={(v) => onModernOnly(v === 'modern')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <View role="group" aria-label="Jump to a family" style={styles.chipRow}>
          {chips.map((f) => (
            <PressableScale
              key={f.key}
              role="link"
              accessibilityLabel={`Jump to ${f.name}, ${f.drinks} drinks`}
              onPress={() => onFamily(f.key)}
              style={[styles.chip, { borderColor: ds.c.lineStrong }]}
            >
              <View style={[styles.mark, styles.round, { backgroundColor: hueOf(f.key) }]} />
              <Caption numberOfLines={1}>{f.name}</Caption>
              <Caption tone="muted">{String(f.drinks)}</Caption>
            </PressableScale>
          ))}
        </View>
      </ScrollView>
      <View aria-label="Key" style={styles.key}>
        <View style={styles.keyItem}>
          {dot({ backgroundColor: ds.c.muted, borderRadius: radius.mark })}
          <Caption tone="muted">{wide ? 'Historic style' : 'Style'}</Caption>
        </View>
        <View style={styles.keyItem}>
          {dot([styles.round, { backgroundColor: ds.c.muted }])}
          <Caption tone="muted">Classic</Caption>
        </View>
        <View style={styles.keyItem}>
          {dot([styles.round, { borderWidth: 2, borderColor: ds.c.muted }])}
          <Caption tone="muted">{wide ? 'Modern classic' : 'Modern'}</Caption>
        </View>
      </View>
      <Caption tone="muted">
        {wide ? 'Colour is the family · lines run parent to riff · from X means the parent is in another family' : 'Swipe sideways for earlier years'}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingBottom: space.sm },
  show: { width: 320 },
  chips: { paddingRight: space.lg },
  chipRow: { flexDirection: 'row', gap: space.sm },
  chip: {
    minHeight: layout.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  key: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mark: { width: 10, height: 10 },
  round: { borderRadius: radius.pill },
});
