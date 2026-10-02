import { StyleSheet } from 'react-native';

import { layout, radius, space } from '@/constants/tokens';

import { PressableScale } from './PressableScale';
import { Caption } from './Text';
import { useDs } from './theme';

/**
 * One choice in a row of choices ("At home", "Martini", "New York"). Put a
 * row of them in a view with role="radiogroup" and an accessible name. The
 * selected one is solid ink, so selection never depends on the accent.
 * `quiet` rests as a line instead of a fill, for a long browse row.
 */
export function Chip({ label, selected, onPress, quiet }: { label: string; selected: boolean; onPress: () => void; quiet?: boolean }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        quiet ? { borderWidth: StyleSheet.hairlineWidth, borderColor: selected ? ds.c.ink : ds.c.lineStrong } : null,
        { backgroundColor: selected ? ds.c.ink : quiet ? 'transparent' : ds.c.raised },
      ]}
    >
      <Caption color={selected ? ds.c.ground : ds.c.ink}>{label}</Caption>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center' },
});
