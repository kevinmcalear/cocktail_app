import { Children, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

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

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
