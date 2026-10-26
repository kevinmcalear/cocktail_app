import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, TextLink, TimeRange, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { RadioPill } from '@/components/screens/publishing/RadioCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { clockLabel, WEEK_DAYS, type HoursRange, type WeekDay, type WeekHours } from '@/lib/barHours';
import { blocksOf, closedLine, closesNextDay, DEFAULT_RANGE, modeFor, setDay, switchMode, tapDay, weekFrom, type HoursBlock, type HoursMode } from '@/lib/hoursWeek';

const MODES: { value: HoursMode; label: string }[] = [
  { value: 'same', label: 'Same every day' },
  { value: 'split', label: 'Weekdays, weekend' },
  { value: 'each', label: 'Each day' },
];
const LETTER: Record<WeekDay, string> = { mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S' };
const NAME: Record<WeekDay, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

/** M T W T F S S: the days a row covers, filled; tap one to move it here or off. */
function DayDots({ on, label, onTap }: { on: WeekDay[]; label: string; onTap: (day: WeekDay) => void }) {
  const ds = useDs();
  return (
    <View role="group" aria-label={label} style={styles.dots}>
      {WEEK_DAYS.map((day) => {
        const picked = on.includes(day);
        return (
          <PressableScale
            key={day}
            role="checkbox"
            aria-checked={picked}
            accessibilityLabel={NAME[day]}
            onPress={() => onTap(day)}
            style={[styles.dot, picked ? { backgroundColor: ds.accentFill.fill, borderColor: ds.accentFill.fill } : { borderColor: ds.c.lineStrong }]}
          >
            <Caption color={picked ? ds.accentFill.text : ds.c.ink} style={styles.bold}>{LETTER[day]}</Caption>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** One row of times: its days, then Opens and Closes. */
function BlockCard({ title, block, onDay, onRange }: { title: string; block: HoursBlock; onDay: (day: WeekDay) => void; onRange: (r: HoursRange) => void }) {
  const ds = useDs();
  return (
    <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <DsText variant="headline">{title}</DsText>
      <DayDots on={block.days} label={title} onTap={onDay} />
      <TimeRange value={block.range} onChange={onRange} name={title} />
      {closesNextDay(block.range) ? <Caption tone="muted">Closes the next morning.</Caption> : null}
    </View>
  );
}

/** Each day: one line a day; the times open under the one tapped, and a closed day opens with Open. */
function EachDay({ blocks, onChange }: { blocks: HoursBlock[]; onChange: (b: HoursBlock[]) => void }) {
  const ds = useDs();
  const [open, setOpen] = useState<WeekDay | null>(null);
  return (
    <View style={[styles.card, styles.list, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      {WEEK_DAYS.map((day, i) => {
        const range = blocks.find((b) => b.days.includes(day))?.range ?? null;
        const text = range ? `${clockLabel(range[0])} to ${clockLabel(range[1])}` : 'Closed';
        return (
          <View key={day} style={[styles.dayRow, i > 0 && { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
            {range ? (
              <PressableScale role="button" aria-expanded={open === day} accessibilityLabel={`${NAME[day]}, ${text}. Change`} onPress={() => setOpen(open === day ? null : day)} style={styles.dayLine}>
                <Body style={styles.dayName}>{NAME[day].slice(0, 3)}</Body>
                <Body style={styles.flex}>{text}</Body>
                <IconSymbol name={open === day ? 'chevron.up' : 'chevron.down'} size={14} color={ds.c.muted} />
              </PressableScale>
            ) : (
              <View style={styles.dayLine}>
                <Body style={styles.dayName}>{NAME[day].slice(0, 3)}</Body>
                <Body tone="muted" style={styles.flex}>Closed</Body>
                <Button
                  label="Open"
                  size="sm"
                  variant="secondary"
                  accessibilityLabel={`Open on ${NAME[day]}`}
                  onPress={() => {
                    onChange(setDay(blocks, day, DEFAULT_RANGE));
                    setOpen(day);
                  }}
                />
              </View>
            )}
            {range && open === day ? (
              <>
                <TimeRange value={range} onChange={(r) => onChange(setDay(blocks, day, r))} name={NAME[day]} />
                <TextLink label={`Closed on ${NAME[day]}s`} onPress={() => onChange(setDay(blocks, day, null))} />
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Where and when's Hours sheet (board w2-venue-setup, E35, call A): how the
 * week runs first, Same every day, Weekdays and weekend, or Each day, opening
 * on whichever fits the saved hours. Saves one range a day, as before; lunch
 * and dinner stay in Venue settings.
 */
export function HoursSheet({ visible, initial, saving, error, onSave, onClose }: {
  visible: boolean;
  initial: WeekHours | null;
  saving?: boolean;
  error?: string | null;
  onSave: (hours: WeekHours) => void;
  onClose: () => void;
}) {
  const [blocks, setBlocks] = useState<HoursBlock[]>(() => {
    const saved = blocksOf(initial);
    // No hours yet: every day, five to midnight, to tap off.
    return saved.length ? saved : [{ days: [...WEEK_DAYS], range: DEFAULT_RANGE }];
  });
  const [mode, setMode] = useState<HoursMode>(() => modeFor(blocks));
  const pick = (to: HoursMode) => {
    setMode(to);
    setBlocks((b) => switchMode(b, to));
  };
  const setRange = (at: number) => (range: HoursRange) => setBlocks((b) => b.map((x, i) => (i === at ? { ...x, range } : x)));
  const closed = closedLine(blocks);

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title="Hours"
      footer={
        <View style={styles.footer}>
          {error ? <Caption tone="accent" role="alert">{error}</Caption> : null}
          <Button label={saving ? 'Saving…' : 'Save hours'} size="lg" disabled={saving} onPress={() => onSave(weekFrom(blocks, initial))} />
        </View>
      }
    >
      {/* Pills that wrap: three labels don't fit one line of a phone-width dialog. */}
      <View role="radiogroup" accessibilityLabel="How the week runs" style={styles.modes}>
        {MODES.map((m) => (
          <RadioPill key={m.value} label={m.label} selected={mode === m.value} onPress={() => pick(m.value)} />
        ))}
      </View>
      {mode === 'same' && blocks[0] ? (
        <BlockCard title="Open on" block={blocks[0]} onDay={(d) => setBlocks((b) => tapDay(b, 0, d))} onRange={setRange(0)} />
      ) : null}
      {mode === 'split'
        ? blocks.slice(0, 2).map((block, i) => (
            <BlockCard key={i} title={i === 0 ? 'Weekdays' : 'Weekend'} block={block} onDay={(d) => setBlocks((b) => tapDay(b, i, d))} onRange={setRange(i)} />
          ))
        : null}
      {mode === 'each' ? <EachDay blocks={blocks} onChange={setBlocks} /> : null}
      {mode === 'split' ? (
        <Caption tone="muted">{`${closed ? `${closed} ` : ''}A day in neither row is closed; tap a day to move it.`}</Caption>
      ) : mode === 'same' && closed ? (
        <Caption tone="muted">{closed}</Caption>
      ) : null}
      {mode === 'split' ? <TextLink label="A day’s different? Set each day, starting from these" onPress={() => pick('each')} /> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.md, borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous' },
  list: { gap: 0, paddingVertical: space.xs },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  dots: { flexDirection: 'row', gap: space.xs },
  // Seven share the row: as big as a tap target where there's room, smaller in a narrow dialog.
  dot: { flex: 1, aspectRatio: 1, maxWidth: layout.minTapTarget, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bold: { fontFamily: fontFamilies.bodySemiBold },
  dayRow: { gap: space.sm, paddingVertical: space.sm },
  dayLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  dayName: { width: 40, fontFamily: fontFamilies.bodySemiBold },
  flex: { flex: 1 },
  footer: { gap: space.sm },
});
