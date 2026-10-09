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
 * `multi` makes it a checkbox, for a group where several can be on (role="group").
 * `disabled` dims it and ignores presses, for a choice the person can see but not change.
 * `accessibilityLabel` names it when the label alone is ambiguous in a list ("I have it" beside each tool).
 */
export function Chip({ label, selected, onPress, quiet, multi, disabled, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; quiet?: boolean; multi?: boolean; disabled?: boolean; accessibilityLabel?: string }) {
  const ds = useDs();
  return (
    <PressableScale
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={[
        styles.chip,
        quiet ? { borderWidth: StyleSheet.hairlineWidth, borderColor: selected ? ds.c.ink : ds.c.lineStrong } : null,
        { backgroundColor: selected ? ds.c.ink : quiet ? 'transparent' : ds.c.raised, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      <Caption color={selected ? ds.c.ground : ds.c.ink}>{label}</Caption>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center' },
});
