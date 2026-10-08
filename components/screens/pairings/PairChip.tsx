import { StyleSheet } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
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
  onPress,
  accessibilityLabel,
}: {
  label: string;
  count?: string | number | null;
  add?: boolean;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const ds = useDs();
  const ink = selected ? ds.c.ground : ds.c.ink;
  return (
    <PressableScale
      role="button"
      aria-pressed={selected}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? ds.c.ink : ds.c.raised, borderColor: ds.c.line }]}
    >
      <Body color={ink}>{add ? `+ ${label}` : label}</Body>
      {count != null && count !== '' ? (
        <Caption color={selected ? ds.c.ground : ds.c.muted} style={styles.count}>
          {String(count)}
        </Caption>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    minHeight: layout.minTapTarget,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  count: { fontFamily: fontFamilies.monoMedium, fontVariant: ['tabular-nums'] },
});
