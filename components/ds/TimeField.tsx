import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';
import { parseTime, timeLabel, toTime, uses12Hour } from '@/lib/calendar';

import { Chip } from './Chip';
import { PickerCell, PickerField, pickerStyles } from './PickerField';
import { Caption } from './Text';

interface TimeFieldProps {
  label: string;
  /** A time, 19:00, or '' for none. */
  value: string;
  onChange: (time: string) => void;
  hint?: string;
  error?: string;
  placeholder?: string;
}

const TWELVE = uses12Hour();
// 12-hour clocks list 12 first (12 AM is midnight); 24-hour clocks run 0 to 23.
const HOURS = TWELVE ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : Array.from({ length: 24 }, (_, h) => h);
// ponytail: quarter hours only, enough for a start time. A typed minute
// (19:10) still shows; offer every five minutes if anything needs it.
const MINUTES = [0, 15, 30, 45];
const rows = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/**
 * A labelled time, picked from hours and minutes that open under it, the
 * way the locale writes a clock (7 PM or 19:00). Pairs with DateField.
 */
export function TimeField({ label, value, onChange, hint, error, placeholder = 'Pick a time' }: TimeFieldProps) {
  const time = parseTime(value);
  const [open, setOpen] = useState(!time);
  // The half of the day to show hours from, before an hour is picked.
  const [pmFallback, setPmFallback] = useState(true);
  const pm = time ? time.hour >= 12 : pmFallback;
  const minute = time?.minute ?? 0;

  const hourOf = (h: number) => (TWELVE ? (h % 12) + (pm ? 12 : 0) : h);
  const setHalf = (toPm: boolean) => {
    setPmFallback(toPm);
    if (time && toPm !== pm) onChange(toTime((time.hour + 12) % 24, time.minute));
  };
  const pickMinute = (m: number) => {
    onChange(toTime(time?.hour ?? hourOf(TWELVE ? 7 : 19), m));
    setOpen(false);
  };

  return (
    <PickerField label={label} text={time ? timeLabel(value) : null} placeholder={placeholder} open={open} onToggle={() => setOpen(!open)} hint={hint} error={error}>
      {TWELVE ? (
        <View role="radiogroup" accessibilityLabel="AM or PM" style={styles.half}>
          <Chip label="AM" selected={!pm} onPress={() => setHalf(false)} quiet />
          <Chip label="PM" selected={pm} onPress={() => setHalf(true)} quiet />
        </View>
      ) : null}
      <Caption tone="muted" style={styles.heading}>
        Hour
      </Caption>
      {rows(HOURS, 6).map((row) => (
        <View key={row[0]} style={pickerStyles.row}>
          {row.map((h) => {
            const hour = hourOf(h);
            return (
              <PickerCell
                key={h}
                label={TWELVE ? String(h) : String(h).padStart(2, '0')}
                accessibilityLabel={timeLabel(toTime(hour, minute))}
                selected={time?.hour === hour}
                onPress={() => onChange(toTime(hour, minute))}
              />
            );
          })}
        </View>
      ))}
      <Caption tone="muted" style={styles.heading}>
        Minutes
      </Caption>
      <View style={pickerStyles.row}>
        {MINUTES.map((m) => (
          <PickerCell key={m} label={`:${String(m).padStart(2, '0')}`} accessibilityLabel={`${m} minutes past`} selected={time?.minute === m} onPress={() => pickMinute(m)} />
        ))}
      </View>
    </PickerField>
  );
}

const styles = StyleSheet.create({
  half: { flexDirection: 'row', gap: space.sm, padding: space.xs },
  heading: { paddingHorizontal: space.sm, paddingTop: space.sm },
});
