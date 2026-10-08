import { StyleSheet, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { palateHues, radius, space } from '@/constants/tokens';
import type { Dimension } from '@/lib/flavor';
import { FAMILY } from '@/lib/palate';

/** A taste's family colour, always beside its name. */
export function FamilyDot({ dim }: { dim: Dimension }) {
  const ds = useDs();
  return <View style={[styles.dot, { backgroundColor: palateHues[ds.scheme][FAMILY[dim]] }]} />;
}

/** The key under a flower: what each mark means here. */
export function PalateLegend({ items }: { items: ('palate' | 'said' | 'drink' | 'ghost')[] }) {
  const ds = useDs();
  const hue = palateHues[ds.scheme].bright;
  const swatch = {
    palate: <View style={[styles.swatch, { backgroundColor: hue }]} />,
    ghost: <View style={[styles.swatch, { backgroundColor: hue, opacity: 0.35 }]} />,
    said: <View style={[styles.dash, { borderColor: ds.c.ink }]} />,
    drink: <View style={[styles.swatch, styles.outline, { borderColor: ds.c.ink }]} />,
  };
  const words = { palate: 'your palate', ghost: 'your palate', said: 'what you said', drink: 'this drink' };
  return (
    <View style={styles.legend} importantForAccessibility="no-hide-descendants" aria-hidden>
      {items.map((k) => (
        <View key={k} style={styles.key}>
          {swatch[k]}
          <Caption tone="muted">{words[k]}</Caption>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: space.sm, height: space.sm, borderRadius: radius.pill },
  legend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: space.lg },
  key: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 18, height: 10, borderRadius: radius.mark },
  outline: { borderWidth: 1.5 },
  dash: { width: 18, borderTopWidth: 1.5, borderStyle: 'dashed' },
});
