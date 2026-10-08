import type { ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';

import { Body, Caption, DsText } from './Text';
import { useDs } from './theme';

interface PickerFieldProps {
  label: string;
  /** What's picked, in words, or null for nothing yet. */
  text: string | null;
  placeholder: string;
  open: boolean;
  onToggle: () => void;
  hint?: string;
  error?: string;
  /** The picker, shown under the field while it's open. */
  children: ReactNode;
}

/**
 * The shell DateField and TimeField share: a labelled box that looks like a
 * Field and opens its picker under it, inside the sheet, on every platform.
 */
export function PickerField({ label, text, placeholder, open, onToggle, hint, error, children }: PickerFieldProps) {
  const ds = useDs();
  const toggle = () => {
    // A keyboard left up from a field above would cover the picker.
    if (!open) Keyboard.dismiss();
    onToggle();
  };
  return (
    <View style={styles.field}>
      <Caption tone="muted">{label}</Caption>
      <Pressable
        role="button"
        aria-expanded={open}
        accessibilityLabel={`${label}: ${text ?? 'none'}`}
        onPress={toggle}
        style={[styles.input, { backgroundColor: ds.c.raised, borderColor: error ? ds.accentText : open ? ds.c.lineStrong : ds.c.line }]}
      >
        <Body color={text ? ds.c.ink : ds.c.faint} style={styles.flex} numberOfLines={1}>
          {text ?? placeholder}
        </Body>
        <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} size={18} color={ds.c.muted} />
      </Pressable>
      {open ? <View style={[styles.panel, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>{children}</View> : null}
      {error ? <Caption tone="accent">{error}</Caption> : hint ? <Caption tone="muted">{hint}</Caption> : null}
    </View>
  );
}

interface PickerCellProps {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  /** Ringed: today, on a calendar. */
  marked?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** One choice in a picker's grid: a day, an hour, a minute. Share a row with flex. */
export function PickerCell({ label, accessibilityLabel, selected, marked, disabled, onPress }: PickerCellProps) {
  const ds = useDs();
  return (
    <Pressable
      role="button"
      aria-pressed={selected}
      aria-disabled={disabled}
      aria-current={marked ? 'date' : undefined}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.cell}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: selected ? ds.c.ink : pressed ? ds.c.line : 'transparent',
              borderColor: marked && !selected ? ds.c.lineStrong : 'transparent',
            },
          ]}
        >
          <DsText
            variant="body"
            color={selected ? ds.c.ground : disabled ? ds.c.faint : ds.c.ink}
            style={{ fontFamily: selected || marked ? fontFamilies.bodySemiBold : fontFamilies.body }}
          >
            {label}
          </DsText>
        </View>
      )}
    </Pressable>
  );
}

export const pickerStyles = StyleSheet.create({
  row: { flexDirection: 'row' },
  /** An empty slot in a grid row, the size of a cell. */
  blank: { flex: 1, height: layout.minTapTarget },
});

const styles = StyleSheet.create({
  field: { gap: space.xs },
  input: { minHeight: layout.minTapTarget, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  panel: { borderRadius: radius.control, borderWidth: 1, padding: space.sm },
  cell: { flex: 1, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  dot: { minWidth: layout.minTapTarget - space.xs, height: layout.minTapTarget - space.xs, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
