import { StyleSheet } from 'react-native';

import { Caption, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';

/**
 * An ingredient that pairs, with the drinks behind it: "Agave Syrup 15".
 * `add` reads "+ Agave Syrup" (it adds to a drink); `selected` fills it.
 */
export function PairChip({
  label,
  count,
  add,
  selected,
  accent,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  count?: string | number | null;
  add?: boolean;
  selected?: boolean;
  /** Selected fills in the accent rather than ink (an ingredient page's Pairs with). */
  accent?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const ds = useDs();
  const fill = accent ? ds.accentFill.fill : ds.c.ink;
  const ink = selected ? (accent ? ds.accentFill.text : ds.c.ground) : ds.c.ink;
  return (
    <PressableScale
      role="button"
      aria-pressed={selected}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? fill : ds.c.raised, borderColor: ds.c.line }]}
    >
      <Caption color={ink}>{add ? `+ ${label}` : label}</Caption>
      {count != null && count !== '' ? (
        <Caption color={selected ? ink : ds.c.muted} style={styles.count}>
          {String(count)}
        </Caption>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.minTapTarget,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  count: { fontFamily: fontFamilies.monoMedium, fontVariant: ['tabular-nums'] },
});
