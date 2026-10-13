import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { fontFamilies, layout, radius, space } from '@/constants/tokens';

import { PressableScale } from './PressableScale';
import { DsText } from './Text';
import { useDs } from './theme';

/**
 * One choice in a row of choices ("At home", "Martini", "New York"). Put a
 * row of them in a view with role="radiogroup" and an accessible name. The
 * selected one is solid ink, so selection never depends on the accent.
 * `quiet` rests as a line instead of a fill, for a long browse row.
 * `multi` makes it a checkbox, for a group where several can be on (role="group").
 * `disabled` dims it and ignores presses, for a choice the person can see but not change.
 * `accessibilityLabel` names it when the label alone is ambiguous in a list ("I have it" beside each tool).
 * `leading` sits before the label: a small decorative picture (an ingredient drawing).
 * `count` follows the label, quieter: how many are in it ("Bottles 12"), or a word ("Negronis the style").
 * `look` is Discover's map layers and sorts (disc-desk-browse, disc-desk-search): 36 tall, the picked one in
 * the accent; `outline` rests as a line, `glass` rests bare inside a glass track.
 */
export function Chip({ label, selected, onPress, quiet, multi, disabled, accessibilityLabel, leading, count, look }: { label: string; selected: boolean; onPress: () => void; quiet?: boolean; multi?: boolean; disabled?: boolean; accessibilityLabel?: string; leading?: ReactNode; count?: number | string; look?: 'outline' | 'glass' }) {
  const ds = useDs();
  const fill = look ? ds.accentFill.fill : ds.c.ink;
  const text = selected ? (look ? ds.accentFill.text : ds.c.ground) : ds.c.ink;
  return (
    <PressableScale
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? (count ? `${label}, ${count}` : label)}
      onPress={onPress}
      style={[
        styles.chip,
        leading || count ? styles.withLeading : null,
        leading ? styles.leadingPad : null,
        quiet || look === 'outline' ? { borderWidth: look ? 1 : StyleSheet.hairlineWidth, borderColor: selected ? fill : ds.c.lineStrong } : null,
        look ? styles.small : null,
        { backgroundColor: selected ? fill : quiet || look ? 'transparent' : ds.c.raised, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      {leading}
      <DsText variant="label" color={text} style={look && selected ? styles.picked : null}>
        {label}
      </DsText>
      {count ? (
        <DsText variant="label" color={selected ? ds.c.ground : ds.c.muted} style={selected ? styles.quietCount : null}>
          {count}
        </DsText>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center' },
  withLeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  leadingPad: { paddingLeft: space.xs },
  quietCount: { opacity: 0.7 },
  // 36 inside a 4-point track makes the 44-point target (disc-desk-browse).
  small: { minHeight: layout.minTapTarget - space.sm, paddingHorizontal: space.md + 2 },
  picked: { fontFamily: fontFamilies.bodySemiBold },
});
