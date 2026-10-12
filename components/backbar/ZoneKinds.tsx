import { StyleSheet, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';

const KINDS = [
  { label: 'Shelf', icon: 'line.3.horizontal' },
  { label: 'Fridge', icon: 'rectangle.stack' },
  { label: 'Freezer', icon: 'snowflake' },
  { label: 'Rail', icon: 'line.3.horizontal' },
  { label: 'Tray', icon: null },
  { label: 'Bar top', icon: null, filled: true },
] as const;

/** The key under the plan: each kind of zone, the way the plan draws it (bar tops filled). */
export function ZoneKinds() {
  const ds = useDs();
  return (
    <View aria-label="Zone kinds" style={styles.row}>
      {KINDS.map((k) => (
        <View key={k.label} style={styles.kind}>
          {k.icon ? (
            <IconSymbol name={k.icon} size={16} color={ds.c.muted} />
          ) : (
            <View style={[styles.box, { borderColor: ds.c.lineStrong, backgroundColor: 'filled' in k ? ds.c.raised : 'transparent' }]} />
          )}
          <Caption tone="muted">{k.label}</Caption>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.sm },
  kind: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  box: { width: 16, height: 12, borderWidth: 1, borderRadius: radius.mark },
});
