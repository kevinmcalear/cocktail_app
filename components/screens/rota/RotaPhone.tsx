import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Surface } from '@/components/ds';
import { SectionHeading, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { space } from '@/constants/tokens';
import type { Shift } from '@/hooks/useRota';
import { dayHeading, shiftLength } from '@/lib/rota';

import { AskNote, EmptyWeek, ShiftRow, WeekStrip } from './RotaParts';
import type { RotaWeek } from './useRotaWeek';

function DayLabel({ title, aside }: { title: string; aside?: string }) {
  return (
    <View style={styles.label}>
      <SectionHeading>{title}</SectionHeading>
      {aside ? <Caption tone="muted">{aside}</Caption> : null}
    </View>
  );
}

/** The rota on a phone: the week, then the nights from the day picked on. */
export function RotaPhone({ r, edit, warning, onOpen, onCopyLast, onCopyNext, onAdd }: {
  r: RotaWeek;
  edit: boolean;
  warning: ReactNode;
  onOpen: (shift: Shift) => void;
  onCopyLast: () => void;
  onCopyNext: () => void;
  onAdd: () => void;
}) {
  const strip = <WeekStrip days={r.days} selected={r.selected} onPick={r.pick} />;
  if (!r.shifts.length) {
    return (
      <>
        {strip}
        {edit ? null : <NextShifts r={r} />}
        <EmptyWeek
          edit={edit}
          actions={
            edit ? (
              <View style={styles.actions}>
                <Button label="Copy last week" icon="arrow.left.arrow.right" variant="ink" onPress={onCopyLast} />
                <Button label="Add a shift" variant="ghost" onPress={onAdd} />
              </View>
            ) : null
          }
        />
      </>
    );
  }
  if (!edit) {
    return (
      <>
        {strip}
        <BartenderDays r={r} />
      </>
    );
  }
  return (
    <>
      {strip}
      {warning}
      <AdminDays r={r} onOpen={onOpen} />
      <Surface style={styles.card}>
        <SettingsRow role="button" icon="arrow.left.arrow.right" label="Copy this week to next week" trailing={<View />} onPress={onCopyNext} />
      </Surface>
    </>
  );
}

/** Who's on each night from the day picked on, for someone who writes the rota to open. */
function AdminDays({ r, onOpen }: { r: RotaWeek; onOpen: (shift: Shift) => void }) {
  const nights = r.days.filter((d) => d.day === r.selected || (d.day > r.selected && d.shifts.length));
  return (
    <>
      {nights.map((d) => (
        <View key={d.day}>
          <DayLabel title={`${dayHeading(d.day)}${d.day === r.today ? ' · tonight' : ''}`} aside={d.day === r.selected && d.shifts.length ? `${d.shifts.length} on` : undefined} />
          {d.shifts.length ? (
            d.shifts.map((s) => {
              const p = r.person(s.user_id);
              return <ShiftRow key={s.id} person={p} title={r.nameOf(s.user_id)} sub={[p?.role, s.note].filter(Boolean).join(' · ')} shift={s} timeZone={r.timeZone} length={shiftLength(s)} onPress={() => onOpen(s)} />;
            })
          ) : (
            <Caption tone="muted">Nobody’s on yet.</Caption>
          )}
        </View>
      ))}
    </>
  );
}

/** A bartender's next shifts, from the coming weeks: there even when the week shown is empty. */
function NextShifts({ r }: { r: RotaWeek }) {
  if (!r.mine.length) return null;
  return (
    <View>
      <DayLabel title="Your next shifts" />
      {r.mine.map((n) => (
        <ShiftRow key={n.shift.id} person={r.person(n.shift.user_id)} title={n.title} sub={n.sub} shift={n.shift} timeZone={r.timeZone} />
      ))}
    </View>
  );
}

/** A bartender's rota: their next shifts, then everyone on the night picked, and who to ask. */
function BartenderDays({ r }: { r: RotaWeek }) {
  const night = r.days.find((d) => d.day === r.selected);
  return (
    <>
      <NextShifts r={r} />
      {night?.shifts.length ? (
        <View>
          <DayLabel title={`${night.day === r.today ? 'Tonight' : dayHeading(night.day)} · everyone`} />
          {night.shifts.map((s) => {
            const p = r.person(s.user_id);
            return <ShiftRow key={s.id} person={p} title={s.user_id === r.me ? 'You' : r.nameOf(s.user_id)} sub={[p?.role, s.note].filter(Boolean).join(' · ')} shift={s} timeZone={r.timeZone} />;
          })}
        </View>
      ) : null}
      <AskNote name={r.maker} />
    </>
  );
}

const styles = StyleSheet.create({
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.md },
  card: { paddingVertical: space.xs, paddingHorizontal: space.lg },
});
