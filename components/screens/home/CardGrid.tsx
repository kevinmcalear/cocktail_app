import { Children, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';

/**
 * Cards as many to a row as fit at `min` wide, each the same width (CSS's
 * repeat(auto-fill, minmax(min, 1fr))): one column on a phone, a grid on a
 * desktop (home-collection-desktop-menus).
 */
export function CardGrid({ min, gap = space.md, children }: { min: number; gap?: number; children: ReactNode }) {
  const [width, setWidth] = useState(0);
  const cols = Math.max(1, Math.floor((width + gap) / (min + gap)));
  const each = width ? (width - gap * (cols - 1)) / cols : undefined;
  return (
    <View role="list" style={[styles.grid, { gap }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {Children.map(children, (child) => (child ? <View role="listitem" style={{ width: each ?? '100%' }}>{child}</View> : null))}
    </View>
  );
}

/** Cards side by side that scroll sideways, each `width` wide (the phone's menu and rail rows). Runs to the screen's edges past the gutter. */
export function CardRail({ width, gutter, children }: { width: number; gutter: number; children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={[styles.rail, { paddingHorizontal: gutter }]}>
      <View role="list" style={styles.rail}>
        {Children.map(children, (child) => (child ? <View role="listitem" style={{ width }}>{child}</View> : null))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  rail: { flexDirection: 'row', gap: space.md, alignItems: 'stretch' },
});
