import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, useTheme } from 'tamagui';

import { AdaptiveSheetModal } from '@/components/ui/AdaptiveSheetModal';
import { RECIPE_UNITS, isKnownUnit, unitLabel } from '@/lib/units';
import { useSettingsStore } from '@/store/useSettingsStore';

type UnitPickerProps = {
  value: string;
  onChange: (unit: string) => void;
  /** Compact trigger for inline recipe rows. */
  size?: 'sm' | 'md';
  onOpenChange?: (open: boolean) => void;
};

export function UnitPicker({ value, onChange, size = 'sm', onOpenChange }: UnitPickerProps) {
  const theme = useTheme();
  const defaultUnit = useSettingsStore((s) => s.defaultUnit);
  const [open, setOpen] = useState(false);
  const current = value || defaultUnit;
  // ponytail: keep legacy free-text units visible until user picks a known one
  const options =
    current && !isKnownUnit(current)
      ? [{ value: current, label: current, group: 'volume' as const }, ...RECIPE_UNITS]
      : RECIPE_UNITS;

  const setVisible = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <>
      <Pressable
        onPressIn={() => onOpenChange?.(true)}
        onPress={() => setVisible(true)}
        style={[
          styles.trigger,
          size === 'md' && styles.triggerMd,
          {
            backgroundColor: theme.backgroundStrong?.get() as string,
            borderColor: theme.borderColor?.get() as string,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Unit: ${unitLabel(current)}`}
      >
        <Text color="$color" fontSize={size === 'md' ? 15 : 13} fontWeight="600">
          {unitLabel(current)}
        </Text>
      </Pressable>

      <AdaptiveSheetModal visible={open} onClose={() => setVisible(false)} title="Unit">
        {options.map((u) => {
          const selected = u.value === current;
          return (
            <Pressable
              key={u.value}
              onPress={() => {
                onChange(u.value);
                setVisible(false);
              }}
              style={[
                styles.option,
                { borderBottomColor: theme.borderColor?.get() as string },
              ]}
            >
              <Text color="$color" fontSize={16} fontWeight={selected ? '700' : '500'}>
                {u.label}
              </Text>
              {selected ? (
                <Text color="$color8" fontSize={14} fontWeight="600">
                  Selected
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </AdaptiveSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerMd: {
    minWidth: 64,
    paddingVertical: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
