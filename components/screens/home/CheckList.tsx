import { StyleSheet, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { palateHues, space } from '@/constants/tokens';

/**
 * What you have for a drink, a prep or a project, as the canvas draws it:
 * "✓ Woodford ✓ lemon ✓ sugar", a green tick before each, wrapping. Read as
 * one line by screen readers ("You have Woodford, lemon, sugar").
 */
export function CheckList({ names }: { names: readonly string[] }) {
  const ds = useDs();
  if (!names.length) return null;
  return (
    <View role="list" accessibilityLabel={`You have ${names.join(', ')}`} style={styles.list}>
      {names.map((n, i) => (
        <View key={`${n}:${i}`} role="listitem" style={styles.item}>
          <IconSymbol name="checkmark" size={12} color={palateHues[ds.scheme].green} />
          <Caption tone="muted">{n}</Caption>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm, rowGap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
