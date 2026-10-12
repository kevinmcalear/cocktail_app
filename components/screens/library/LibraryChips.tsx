import { Fragment, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';

/**
 * A row of filters. On a phone it's one line that scrolls sideways, edge to
 * edge; with `whole` (desktop) it wraps, with a thin line between each group.
 */
export function FilterRow({ label, gutter, whole, groups }: { label: string; gutter: number; whole?: boolean; groups: ReactNode[][] }) {
  const ds = useDs();
  const chips = groups
    .filter((g) => g.length)
    .map((g, i) => (
      <Fragment key={i}>
        {i > 0 ? <View style={[whole ? styles.divider : styles.gap, { backgroundColor: ds.c.lineStrong }]} /> : null}
        {g}
      </Fragment>
    ));
  if (whole) {
    return (
      <View role="radiogroup" accessibilityLabel={label} style={[styles.filters, styles.wrap]}>
        {chips}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      role="radiogroup"
      accessibilityLabel={label}
      style={{ marginHorizontal: -gutter }}
      contentContainerStyle={[styles.filters, { paddingHorizontal: gutter }]}
    >
      {chips}
    </ScrollView>
  );
}

/** One filter chip: its name and, in mono, how many. */
export function Filter({ label, count, selected, onPress }: { label: string; count?: number; selected: boolean; onPress: () => void }) {
  const ds = useDs();
  const ink = selected ? ds.accentFill.text : ds.c.ink;
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      accessibilityLabel={count == null ? label : `${label}, ${count}`}
      onPress={onPress}
      style={[styles.filter, selected ? { backgroundColor: ds.accentFill.fill, borderColor: ds.accentFill.fill } : { borderColor: ds.c.lineStrong }]}
    >
      <Body color={ink} style={selected ? styles.picked : undefined}>
        {label}
      </Body>
      {count == null ? null : (
        <Caption color={selected ? ds.accentFill.text : ds.c.muted} style={styles.count}>
          {count}
        </Caption>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wrap: { flexWrap: 'wrap' },
  divider: { width: StyleSheet.hairlineWidth, height: 24, marginHorizontal: space.xs },
  gap: { width: 0, height: 0 },
  filter: { minHeight: 38, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  picked: { fontFamily: fontFamilies.bodySemiBold },
  count: { fontFamily: fontFamilies.mono },
});
