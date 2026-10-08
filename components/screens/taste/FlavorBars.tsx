import { StyleSheet, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { DIMENSIONS, LABEL, level, type Taste } from '@/lib/flavor';

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A profile as bars with words, strongest first (never numbers, which would
 * claim more precision than we have). Dimensions under `from` are left off.
 */
export function FlavorBars({ values, from = 0 }: { values: Taste; from?: number }) {
  const ds = useDs();
  const shown = DIMENSIONS.filter((d) => typeof values[d] === 'number' && values[d]! >= from).sort((a, b) => values[b]! - values[a]!);
  return (
    <View role="list" style={styles.bars}>
      {shown.map((d) => (
        <View key={d} role="listitem" accessible accessibilityLabel={`${capital(LABEL[d])}: ${level(values[d]!)}`} style={styles.row}>
          <Caption style={styles.label}>{capital(LABEL[d])}</Caption>
          <View style={[styles.track, { backgroundColor: ds.c.raised }]}>
            <View style={[styles.fill, { width: `${Math.round(values[d]! * 100)}%`, backgroundColor: ds.c.muted }]} />
          </View>
          <Caption tone="muted" style={styles.word}>
            {level(values[d]!)}
          </Caption>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { width: 72 },
  track: { flex: 1, height: space.sm, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  word: { width: 72 },
});
