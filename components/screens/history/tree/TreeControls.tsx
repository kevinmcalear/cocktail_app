import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, PressableScale, Segmented, useDs } from '@/components/ds';
import { familyHues, fontFamilies, layout, radius, space } from '@/constants/tokens';
import type { AxisFamily } from '@/lib/timeTree';

const SHOW = [
  { value: 'all', label: 'All' },
  { value: 'modern', label: 'Modern classics' },
] as const;

/**
 * Above the time-axis tree: All or Modern classics, a chip per family (its
 * colour, and its count on desktop) that jumps down to it, and the key to the
 * marks (boards prep-hist-tree-phone and -desktop).
 */
export function TreeControls({
  families,
  modernOnly,
  onModernOnly,
  onFamily,
  wide,
  search,
}: {
  families: AxisFamily[];
  modernOnly: boolean;
  onModernOnly: (on: boolean) => void;
  onFamily: (key: string) => void;
  wide: boolean;
  /** Desktop: the search field, first in the row (board prep-hist-tree-desktop). */
  search?: ReactNode;
}) {
  const ds = useDs();
  const hues = familyHues[ds.scheme];
  const hueOf = (family: string) => hues[family as keyof typeof hues] ?? hues.trunk;
  const chips = families.filter((f) => f.key !== 'trunk');
  const dot = (style: object) => <View style={[styles.mark, style]} />;
  const show = <Segmented accessibilityLabel="Show" options={SHOW} value={modernOnly ? 'modern' : 'all'} onChange={(v) => onModernOnly(v === 'modern')} variant="pill" />;
  const chipRow = (
    <View role="group" aria-label="Jump to a family" style={[styles.chipRow, wide ? styles.wrapRow : null]}>
      {chips.map((f) => (
        <PressableScale
          key={f.key}
          role="link"
          accessibilityLabel={`Jump to ${f.name}, ${f.drinks} drinks`}
          onPress={() => onFamily(f.key)}
          style={[styles.chip, { borderColor: ds.c.lineStrong }]}
        >
          <View style={[styles.mark, styles.round, { backgroundColor: hueOf(f.key) }]} />
          {/* Phones say the family's first name ("Negroni"), as drawn. */}
          <Caption numberOfLines={1} style={styles.strong}>
            {wide ? f.name : f.name.split(/ & |, /)[0]}
          </Caption>
          {wide ? <Caption tone="muted" style={styles.mono}>{String(f.drinks)}</Caption> : null}
        </PressableScale>
      ))}
    </View>
  );
  const key = (
    <View aria-label="Key" style={styles.key}>
      <View style={styles.keyItem}>
        {dot({ backgroundColor: ds.c.muted, borderRadius: radius.mark / 2 })}
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
      <Caption tone="muted">
        {wide ? 'Colour is the family · lines run parent to riff · from X means the parent is in another family · ? means low confidence' : '? low confidence'}
      </Caption>
    </View>
  );
  if (wide) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.wideRow, { borderBottomColor: ds.c.line }]}>
          {search}
          {show}
          {chipRow}
        </View>
        {key}
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <View style={styles.chipRow}>
          {show}
          {chipRow}
        </View>
      </ScrollView>
      {key}
      <Caption tone="muted">Swipe sideways for earlier years</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingBottom: space.sm },
  wideRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.lg, rowGap: space.sm, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 2 },
  wrapRow: { flexWrap: 'wrap', flexBasis: '100%' },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  mono: { fontFamily: fontFamilies.mono },
  chips: { paddingRight: space.lg },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chip: {
    minHeight: layout.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  key: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.lg, rowGap: space.xs },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mark: { width: 10, height: 10 },
  round: { borderRadius: radius.pill },
});
