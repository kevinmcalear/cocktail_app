import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, GlassButton } from '@/components/ds';
import { PickerCell, PickerField, pickerStyles } from '@/components/ds/PickerField';
import { space } from '@/constants/tokens';
import { monthLabel, type JobMonth } from '@/lib/onboarding';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A job's month and year ("Feb 2023"): a year to step through and the twelve
 * months under it, opening under the field like DateField.
 */
export function MonthField({ label, value, onChange, max }: { label: string; value: JobMonth | null; onChange: (m: JobMonth) => void; max: JobMonth }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(value?.year ?? max.year);
  const after = (month: number) => year > max.year || (year === max.year && month > max.month);
  return (
    <PickerField label={label} text={monthLabel(value)} placeholder="Month" open={open} onToggle={() => setOpen((o) => !o)}>
      <View style={styles.year}>
        <GlassButton accessibilityLabel="Year before" icon="chevron.left" onPress={() => setYear((y) => y - 1)} />
        <Body accessibilityLiveRegion="polite">{String(year)}</Body>
        <GlassButton accessibilityLabel="Year after" icon="chevron.right" onPress={() => setYear((y) => Math.min(max.year, y + 1))} />
      </View>
      {[0, 1, 2].map((row) => (
        <View key={row} style={pickerStyles.row}>
          {MONTHS.slice(row * 4, row * 4 + 4).map((name, i) => {
            const month = row * 4 + i + 1;
            return (
              <PickerCell
                key={name}
                label={name}
                accessibilityLabel={`${name} ${year}`}
                selected={value?.year === year && value.month === month}
                disabled={after(month)}
                onPress={() => {
                  onChange({ year, month });
                  setOpen(false);
                }}
              />
            );
          })}
        </View>
      ))}
    </PickerField>
  );
}

const styles = StyleSheet.create({
  year: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.sm },
});
