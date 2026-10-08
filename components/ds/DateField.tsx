import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, space } from '@/constants/tokens';
import { monthOf, monthWeeks, outside, shiftMonth, weekStart, type Month } from '@/lib/calendar';
import { dayLabel, toDay } from '@/lib/collection';

import { PickerCell, PickerField, pickerStyles } from './PickerField';
import { PressableScale } from './PressableScale';
import { Caption, DsText } from './Text';
import { useDs } from './theme';

interface DateFieldProps {
  label: string;
  /** A day, 2026-10-04, or '' for none. */
  value: string;
  onChange: (day: string) => void;
  /** The earliest and latest days that can be picked, inclusive. */
  min?: string;
  max?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  /** Offers "Clear", for a date that can be left blank. */
  clearable?: boolean;
}

const FIRST_DAY = weekStart();
// 4 Oct 2026 is a Sunday: the seven weekdays from there, for the header.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 4 + ((FIRST_DAY + i) % 7)));

/**
 * A labelled date, picked from a month calendar that opens under it. Drawn
 * the same on web, iOS and Android, so it sits inside sheets without a
 * second modal and ships without a native module.
 */
export function DateField({ label, value, onChange, min, max, hint, error, placeholder = 'Pick a day', clearable }: DateFieldProps) {
  const [now] = useState(() => Date.now());
  const today = toDay(new Date(now));
  const start = () => monthOf(value || (min && today < min ? min : max && today > max ? max : today));
  // Opens at once when a day is needed and none is picked yet.
  const [open, setOpen] = useState(!value && !clearable);
  const [shown, setShown] = useState<Month>(start);

  const toggle = () => {
    if (!open) setShown(start());
    setOpen(!open);
  };
  const pick = (day: string) => {
    onChange(day);
    setOpen(false);
  };

  const first = toDay(new Date(shown.year, shown.month, 1));
  const last = toDay(new Date(shown.year, shown.month + 1, 0));
  const title = new Date(shown.year, shown.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <PickerField label={label} text={value ? dayLabel(value, now) : null} placeholder={placeholder} open={open} onToggle={toggle} hint={hint} error={error}>
      <View style={styles.head}>
        <MonthArrow back disabled={Boolean(min && first <= min)} onPress={() => setShown(shiftMonth(shown, -1))} />
        <DsText variant="body" style={styles.title} role="heading" aria-live="polite">
          {title}
        </DsText>
        <MonthArrow disabled={Boolean(max && last >= max)} onPress={() => setShown(shiftMonth(shown, 1))} />
      </View>
      <View style={pickerStyles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {WEEKDAYS.map((d) => (
          <Caption key={d.getDay()} tone="muted" style={styles.weekday}>
            {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
          </Caption>
        ))}
      </View>
      {monthWeeks(shown, FIRST_DAY).map((week) => (
        <View key={week.find(Boolean)} style={pickerStyles.row}>
          {week.map((day, i) => (day ? <Day key={day} day={day} selected={day === value} today={day === today} disabled={outside(day, min, max)} onPress={() => pick(day)} /> : <View key={i} style={pickerStyles.blank} />))}
        </View>
      ))}
      {clearable && value ? (
        <Pressable role="button" accessibilityLabel={`Clear ${label}`} onPress={() => pick('')} style={styles.clear}>
          <Caption tone="muted">Clear</Caption>
        </Pressable>
      ) : null}
    </PickerField>
  );
}

function MonthArrow({ back, disabled, onPress }: { back?: boolean; disabled: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      accessibilityLabel={back ? 'Previous month' : 'Next month'}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={[styles.arrow, { opacity: disabled ? 0.3 : 1 }]}
    >
      {/* chevron.left is an arrow on Android (the back button), so a month back is chevron.right turned round. */}
      <IconSymbol name="chevron.right" size={20} color={ds.c.ink} style={back ? styles.flip : undefined} />
    </PressableScale>
  );
}

function Day({ day, selected, today, disabled, onPress }: { day: string; selected: boolean; today: boolean; disabled: boolean; onPress: () => void }) {
  const [y, m, d] = day.split('-').map(Number);
  const name = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return <PickerCell label={String(d)} accessibilityLabel={today ? `Today, ${name}` : name} selected={selected} marked={today} disabled={disabled} onPress={onPress} />;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xs },
  title: { flex: 1, textAlign: 'center', fontFamily: fontFamilies.bodySemiBold },
  arrow: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  flip: { transform: [{ rotate: '180deg' }] },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: space.xs },
  clear: { alignSelf: 'flex-end', minHeight: layout.minTapTarget, paddingHorizontal: space.md, justifyContent: 'center' },
});
