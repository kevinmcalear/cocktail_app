import { StyleSheet, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { palateHues, radius, space } from '@/constants/tokens';

/**
 * What you have for a drink, a prep or a project, as the canvas draws it:
 * "✓ Woodford ✓ lemon ✓ sugar", a green tick before each, wrapping. Read as
 * one line by screen readers ("You have Woodford, lemon, sugar").
 */
export function CheckList({ names, chips }: { names: readonly string[]; /** Each as a small ticked chip (a project's card). */ chips?: boolean }) {
  const ds = useDs();
  if (!names.length) return null;
  return (
    <View role="list" accessibilityLabel={`You have ${names.join(', ')}`} style={[styles.list, chips ? styles.chips : null]}>
      {names.map((n, i) => (
        <View key={`${n}:${i}`} role="listitem" style={[styles.item, chips ? [styles.chip, { backgroundColor: ds.c.raised }] : null]}>
          <IconSymbol name="checkmark" size={12} color={palateHues[ds.scheme].green} />
          <Caption tone={chips ? 'ink' : 'muted'}>{n}</Caption>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm, rowGap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chips: { gap: 6 },
  chip: { minHeight: 28, paddingHorizontal: 10, borderRadius: radius.pill, gap: space.xs },
});
