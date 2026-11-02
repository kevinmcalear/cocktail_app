import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, radius, space, STATUS } from '@/constants/tokens';
import type { Shift } from '@/hooks/useRota';
import { readableAccent, withAlpha } from '@/lib/color';
import { closedOn, columnNote, dateNumber, gridPeople, shiftTimes, totalHours, weekdayLong, weekdayShort } from '@/lib/rota';

import { PersonMark, ShiftTags } from './RotaParts';
import type { RotaPerson, RotaWeek } from './useRotaWeek';

const NAME_COLUMN = 190;
const ROW = 74;

/** The grid's key, by the title. */
export function GridKey() {
  return (
    <View style={styles.key}>
      <Tag label="Opens" tone="success" />
      <Tag label="Closes" tone="warning" />
      <Caption tone="muted">Hours in each shift</Caption>
    </View>
  );
}

/** The week on the web: people down the side, nights across, a shift in each cell. An empty cell takes a shift on hover or focus. */
export function RotaGrid({ r, edit, onOpen, onAdd }: { r: RotaWeek; edit: boolean; onOpen: (shift: Shift) => void; onAdd: (night: string, userId: string) => void }) {
  const ds = useDs();
  const amber = readableAccent(STATUS.warning, ds.c.ground);
  const gaps = r.gaps.map((d) => d.day);
  const todayBg = (day: string) => (day === r.today ? withAlpha(ds.c.ink, 0.04) : 'transparent');
  // Someone who's left the team keeps their shifts until they're deleted: a row under the team.
  const gone = [...new Set(r.shifts.map((s) => s.user_id))].filter((id) => !r.person(id));
  const rows: { id: string; person?: RotaPerson }[] = [...gridPeople(r.people, r.shifts, edit).map((p) => ({ id: p.user_id, person: p })), ...gone.map((id) => ({ id }))];
  const edge = { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: ds.c.line };
  return (
    <View role="table" aria-label="This week's rota" style={[styles.table, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View role="row" style={[styles.row, styles.rule, { borderBottomColor: ds.c.line }]}>
        <View style={styles.nameHead} />
        {r.days.map(({ day }) => {
          const note = columnNote(day, r.today, closedOn(r.hours, day), gaps.includes(day));
          return (
            <View key={day} role="columnheader" accessibilityLabel={[weekdayLong(day), dateNumber(day), note?.text].filter(Boolean).join(' ')} style={[styles.head, edge, { backgroundColor: todayBg(day) }]}>
              <Caption tone="muted">{weekdayShort(day)}</Caption>
              <DsText variant="headline" style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
                {dateNumber(day)}
              </DsText>
              <View style={styles.flex} />
              {note ? (
                <Caption color={note.warn ? amber : ds.c.muted} numberOfLines={1}>
                  {note.text}
                </Caption>
              ) : null}
            </View>
          );
        })}
      </View>
      {rows.map(({ id, person }, i) => (
        <View key={id} role="row" style={[styles.row, i < rows.length - 1 && [styles.rule, { borderBottomColor: ds.c.line }]]}>
          <View role="rowheader" style={styles.name}>
            <PersonMark person={person} size={32} />
            <View style={styles.flex}>
              <DsText variant="label" numberOfLines={1}>
                {person?.name ?? 'Someone'}
              </DsText>
              <Caption tone="muted" numberOfLines={2}>
                {[person?.role, totalHours(r.shifts.filter((s) => s.user_id === id))].filter(Boolean).join(' · ')}
              </Caption>
            </View>
          </View>
          {r.days.map(({ day, shifts }) => {
            const cell = shifts.filter((s) => s.user_id === id);
            return (
              <View key={day} role="cell" style={[styles.cell, edge, { backgroundColor: todayBg(day) }]}>
                {cell.map((s) => (
                  <ShiftCell key={s.id} shift={s} timeZone={r.timeZone} today={day === r.today} onPress={edit ? () => onOpen(s) : undefined} />
                ))}
                {!cell.length && edit && person ? <AddCell name={person.name} day={day} onPress={() => onAdd(day, id)} /> : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function ShiftCell({ shift, timeZone, today, onPress }: { shift: Shift; timeZone: string | null; today: boolean; onPress?: () => void }) {
  const ds = useDs();
  const time = shiftTimes(shift, timeZone);
  const look = [styles.shift, today ? { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong, borderWidth: StyleSheet.hairlineWidth } : { backgroundColor: withAlpha(ds.c.ink, 0.06) }];
  const body = (
    <>
      <DsText variant="caption">{time}</DsText>
      {shift.opens || shift.closes ? (
        <View style={styles.tags}>
          <ShiftTags shift={shift} />
        </View>
      ) : null}
    </>
  );
  return onPress ? (
    <PressableScale role="button" accessibilityLabel={[time, shift.opens ? 'opens' : null, shift.closes ? 'closes' : null].filter(Boolean).join(', ')} onPress={onPress} style={look}>
      {body}
    </PressableScale>
  ) : (
    <View style={look}>{body}</View>
  );
}

/** The dashed plus of an empty cell, there while the pointer or the keyboard is on it. */
function AddCell({ name, day, onPress }: { name: string; day: string; onPress: () => void }) {
  const ds = useDs();
  const [shown, setShown] = useState(false);
  return (
    <Pressable
      role="button"
      accessibilityLabel={`Add a shift for ${name} on ${weekdayLong(day)}`}
      onPress={onPress}
      onHoverIn={() => setShown(true)}
      onHoverOut={() => setShown(false)}
      onFocus={() => setShown(true)}
      onBlur={() => setShown(false)}
      style={[styles.add, { borderColor: shown ? ds.c.lineStrong : 'transparent' }]}
    >
      {shown ? <IconSymbol name="plus" size={18} color={ds.c.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  key: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, alignSelf: 'flex-end' },
  table: { borderRadius: radius.card - 4, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth },
  nameHead: { width: NAME_COLUMN },
  head: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: space.xs + 2, paddingHorizontal: space.sm + 2, paddingVertical: space.md },
  name: { width: NAME_COLUMN, minHeight: ROW, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingHorizontal: space.md + 2 },
  cell: { flex: 1, minWidth: 0, minHeight: ROW, padding: space.sm, gap: space.xs },
  shift: { flex: 1, minHeight: ROW - space.lg, borderRadius: radius.control, paddingHorizontal: space.sm + 1, paddingVertical: space.sm, justifyContent: 'space-between', gap: space.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  add: { flex: 1, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
