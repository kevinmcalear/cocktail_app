import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';

/**
 * Under a line on the desktop page and, for Prep or Costs, the phone wizard:
 * what this pour costs, "Made here" for a house prep, and for a new bottle a
 * "New" tag and a chip that opens its card under the line.
 */
export function LineDetail({ line, tag, words, price, open, onPress }: { line?: string; tag?: string; words?: string; price: string | null; open?: boolean; onPress?: () => void }) {
  const ds = useDs();
  if (!onPress && !tag) return words || price ? <Caption tone="muted" numberOfLines={1}>{[words, price].filter(Boolean).join(' · ')}</Caption> : null;
  return (
    <View style={styles.detail}>
      {tag ? <Tag label={tag} tone="success" /> : null}
      {words ? <Caption tone="muted" numberOfLines={1}>{words}</Caption> : null}
      {onPress ? (
        <PressableScale
          onPress={onPress}
          haptic={false}
          role="button"
          aria-expanded={!!open}
          accessibilityLabel={`Bottle details: ${line}`}
          accessibilityHint="Opens the new bottle under the line"
          style={[styles.chip, { borderColor: open ? ds.c.ink : ds.c.lineStrong }]}
        >
          <Caption numberOfLines={1}>Bottle details</Caption>
          <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} size={12} color={ds.c.muted} />
        </PressableScale>
      ) : null}
      {price ? <DsText variant="spec" color={ds.c.muted} style={styles.mono}>{price}</DsText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 28, maxWidth: 240, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  mono: { fontFamily: fontFamilies.mono },
});
