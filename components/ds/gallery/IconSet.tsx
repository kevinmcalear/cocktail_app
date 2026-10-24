import { StyleSheet, View } from 'react-native';

import { glyphNames } from '@/components/ui/glyphs';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';

import { Caption } from '../Text';
import { useDs } from '../theme';

/** Every icon in the set, off and then on (the nav-icons board's grid), so a new one is checked against the rest. */
export function IconSet() {
  const ds = useDs();
  return (
    <View style={styles.grid}>
      {glyphNames.map((name) => (
        <View key={name} style={[styles.cell, { backgroundColor: ds.c.surface }]}>
          <View style={styles.pair}>
            <IconSymbol name={name} size={24} color={ds.c.muted} />
            <IconSymbol name={name} size={24} color={ds.accentText} on />
          </View>
          <Caption tone="muted" numberOfLines={1}>
            {name}
          </Caption>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: 132, alignItems: 'center', gap: space.xs, paddingVertical: space.md, paddingHorizontal: space.xs, borderRadius: radius.control },
  pair: { flexDirection: 'row', gap: space.md },
});
