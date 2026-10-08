import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { monthOf, monthWeeks, outside, shiftMonth, weekStart, type Month } from '@/lib/calendar';
import { dayLabel, toDay } from '@/lib/collection';

import { PressableScale } from './PressableScale';
import { Body, Caption, DsText } from './Text';
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
  const ds = useDs();
  const [now] = useState(() => Date.now());
  const today = toDay(new Date(now));
  const start = () => monthOf(value || (min && today < min ? min : max && today > max ? max : today));
  // Opens at once when a day is needed and none is picked yet.
  const [open, setOpen] = useState(!value && !clearable);
  const [shown, setShown] = useState<Month>(start);

  const toggle = () => {
    if (!open) {
      // A keyboard left up from a field above would cover the calendar.
      Keyboard.dismiss();
      setShown(start());
    }
    setOpen(!open);
  };
  const pick = (day: string) => {
    onChange(day);
    setOpen(false);
  };

  const text = value ? dayLabel(value, now) : placeholder;
  const first = toDay(new Date(shown.year, shown.month, 1));
  const last = toDay(new Date(shown.year, shown.month + 1, 0));
  const canBack = !min || first > min;
  const canOn = !max || last < max;
  const title = new Date(shown.year, shown.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <View style={styles.field}>
      <Caption tone="muted">{label}</Caption>
      <Pressable
        role="button"
        aria-expanded={open}
        accessibilityLabel={`${label}: ${value ? text : 'none'}`}
        onPress={toggle}
        style={[styles.input, { backgroundColor: ds.c.raised, borderColor: error ? ds.accentText : open ? ds.c.lineStrong : ds.c.line }]}
      >
        <Body color={value ? ds.c.ink : ds.c.faint} style={styles.flex} numberOfLines={1}>
          {text}
        </Body>
        <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} size={18} color={ds.c.muted} />
      </Pressable>

      {open ? (
        <View style={[styles.calendar, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
          <View style={styles.head}>
            <MonthArrow back disabled={!canBack} onPress={() => setShown(shiftMonth(shown, -1))} />
            <DsText variant="body" style={styles.title} role="heading" aria-live="polite">
              {title}
            </DsText>
            <MonthArrow disabled={!canOn} onPress={() => setShown(shiftMonth(shown, 1))} />
          </View>
          <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {WEEKDAYS.map((d) => (
              <Caption key={d.getDay()} tone="muted" style={styles.weekday}>
                {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
              </Caption>
            ))}
          </View>
          {monthWeeks(shown, FIRST_DAY).map((week) => (
            <View key={week.find(Boolean)} style={styles.week}>
              {week.map((day, i) =>
                day ? <Day key={day} day={day} selected={day === value} today={day === today} disabled={outside(day, min, max)} onPress={() => pick(day)} /> : <View key={i} style={styles.cell} />,
              )}
            </View>
          ))}
          {clearable && value ? (
            <Pressable role="button" accessibilityLabel={`Clear ${label}`} onPress={() => pick('')} style={styles.clear}>
              <Caption tone="muted">Clear</Caption>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {error ? <Caption tone="accent">{error}</Caption> : hint ? <Caption tone="muted">{hint}</Caption> : null}
    </View>
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
  const ds = useDs();
  const [y, m, d] = day.split('-').map(Number);
  const name = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <Pressable
      role="button"
      aria-pressed={selected}
      aria-disabled={disabled}
      aria-current={today ? 'date' : undefined}
      disabled={disabled}
      accessibilityLabel={today ? `Today, ${name}` : name}
      onPress={onPress}
      style={styles.cell}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: selected ? ds.c.ink : pressed ? ds.c.line : 'transparent',
              borderColor: today && !selected ? ds.c.lineStrong : 'transparent',
            },
          ]}
        >
          <DsText
            variant="body"
            color={selected ? ds.c.ground : disabled ? ds.c.faint : ds.c.ink}
            style={{ fontFamily: selected || today ? fontFamilies.bodySemiBold : fontFamilies.body }}
          >
            {String(d)}
          </DsText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  input: { minHeight: layout.minTapTarget, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  calendar: { borderRadius: radius.control, borderWidth: 1, padding: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xs },
  title: { flex: 1, textAlign: 'center', fontFamily: fontFamilies.bodySemiBold },
  arrow: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  flip: { transform: [{ rotate: '180deg' }] },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: space.xs },
  cell: { flex: 1, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  dot: { width: layout.minTapTarget - space.xs, height: layout.minTapTarget - space.xs, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  clear: { alignSelf: 'flex-end', minHeight: layout.minTapTarget, paddingHorizontal: space.md, justifyContent: 'center' },
});
