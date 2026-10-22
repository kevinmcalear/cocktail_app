import { Fragment, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useDs } from '@/components/ds';
import { space } from '@/constants/tokens';

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

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wrap: { flexWrap: 'wrap' },
  divider: { width: StyleSheet.hairlineWidth, height: 24, marginHorizontal: space.xs },
  gap: { width: 0, height: 0 },
});
