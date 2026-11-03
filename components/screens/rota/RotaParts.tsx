import { useRef, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, Tag, Title, useDs } from '@/components/ds';
import { PopoverMenu, usePopover } from '@/components/ds/PopoverMenu';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { displayFaces, radius, space, STATUS } from '@/constants/tokens';
import type { Shift } from '@/hooks/useRota';
import { readableAccent, withAlpha } from '@/lib/color';
import { dateNumber, shiftTimes, weekdayLong, weekdayShort, type RotaDay } from '@/lib/rota';

import type { RotaPerson } from './useRotaWeek';

/** Opens, Closes: green and amber, and the word says it. */
export function ShiftTags({ shift }: { shift: Pick<Shift, 'opens' | 'closes'> }) {
  return (
    <>
      {shift.opens ? <Tag label="Opens" tone="success" /> : null}
      {shift.closes ? <Tag label="Closes" tone="warning" /> : null}
    </>
  );
}

export function PersonMark({ person, size = 40 }: { person?: RotaPerson; size?: number }) {
  return <UserAvatar uri={person?.member.avatar_url} name={person?.name ?? 'Someone'} email={person?.member.email} size={size} />;
}

/** One shift: who or when on the left with its tag, the time and maybe its length on the right. */
export function ShiftRow({ person, title, sub, shift, timeZone, length, onPress }: {
  person?: RotaPerson;
  title: string;
  sub: string;
  shift: Shift;
  timeZone: string | null;
  length?: string;
  /** Someone who writes the rota opens the shift. */
  onPress?: () => void;
}) {
  const ds = useDs();
  const time = shiftTimes(shift, timeZone);
  const row = (
    <>
      <PersonMark person={person} />
      <View style={styles.text}>
        <View style={styles.title}>
          <Body numberOfLines={1} style={styles.shrink}>
            {title}
          </Body>
          <ShiftTags shift={shift} />
        </View>
        {sub ? <Caption tone="muted">{sub}</Caption> : null}
      </View>
      <View style={styles.end}>
        <DsText variant="label">{time}</DsText>
        {length ? <Caption tone="muted">{length}</Caption> : null}
      </View>
    </>
  );
  const style = [styles.row, { borderBottomColor: ds.c.line }];
  return onPress ? (
    <PressableScale role="button" accessibilityLabel={[`${title}, ${time}`, sub, shift.opens ? 'Opens' : null, shift.closes ? 'Closes' : null].filter(Boolean).join('. ')} onPress={onPress} style={style}>
      {row}
    </PressableScale>
  ) : (
    <View style={style}>{row}</View>
  );
}

/** Mon to Sun with a dot where anyone's on; the day picked sits on the ink. */
export function WeekStrip({ days, selected, onPick }: { days: RotaDay[]; selected: string; onPick: (day: string) => void }) {
  const ds = useDs();
  return (
    <View role="radiogroup" aria-label="Day" style={styles.strip}>
      {days.map(({ day, shifts }) => {
        const on = day === selected;
        const label = `${weekdayLong(day)} ${dateNumber(day)}, ${shifts.length ? `${shifts.length} on` : 'nobody on'}`;
        return (
          <PressableScale key={day} role="radio" aria-checked={on} accessibilityLabel={label} onPress={() => onPick(day)} style={[styles.day, on && { backgroundColor: ds.c.ink }]}>
            <Caption color={on ? ds.c.ground : ds.c.muted}>{weekdayShort(day)}</Caption>
            <DsText variant="headline" color={on ? ds.c.ground : ds.c.ink} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
              {dateNumber(day)}
            </DsText>
            <View style={[styles.dot, { backgroundColor: shifts.length ? (on ? ds.c.ground : ds.accentText) : 'transparent' }]} />
          </PressableScale>
        );
      })}
    </View>
  );
}

/** "Saturday: nobody closes yet", and Pick someone: a menu of who's on that night. */
export function CloseWarning({ day, nameOf, timeZone, wide, onPick }: { day: RotaDay; nameOf: (id: string) => string; timeZone: string | null; wide: boolean; onPick: (shift: Shift) => void }) {
  const amber = readableAccent(STATUS.warning, useDs().c.ground);
  const menu = usePopover();
  const button = useRef<ComponentRef<typeof View>>(null);
  const items = day.shifts.map((s) => ({ label: nameOf(s.user_id), detail: shiftTimes(s, timeZone), onPress: () => onPick(s) }));
  const name = weekdayLong(day.day);
  return (
    <View style={[styles.warn, wide && styles.warnWide, { backgroundColor: withAlpha(STATUS.warning, 0.16) }]}>
      <View style={[styles.warnLine, wide && styles.flex]}>
        <IconSymbol name="exclamationmark.triangle" size={19} color={amber} />
        <Body color={amber} style={styles.flex}>
          {`${name}: nobody closes yet${wide ? '.' : ''}`}
        </Body>
      </View>
      <View ref={button} collapsable={false} style={styles.warnAction}>
        <Button label="Pick someone" size="sm" variant="secondary" accessibilityLabel={`Pick who closes ${name}`} onPress={() => menu.open(button.current)} />
        <PopoverMenu anchor={menu.anchor} label={`Who closes ${name}`} onClose={menu.close} sections={[{ items }]} />
      </View>
    </View>
  );
}

/** Nobody on this week: the calendar, what happens next, and for someone who writes the rota how to start. */
export function EmptyWeek({ edit, actions }: { edit: boolean; actions?: ReactNode }) {
  const ds = useDs();
  return (
    <View style={styles.empty}>
      <IconSymbol name="calendar" size={110} color={ds.c.muted} />
      <Title align="center">Nobody’s on this week yet</Title>
      <Body tone="muted" align="center">
        {edit ? 'Start from last week’s rota, or add shifts one by one. The team sees it on Tonight.' : 'When the rota is up, your shifts show here and on Tonight.'}
      </Body>
      {actions}
    </View>
  );
}

/** "Ana makes the rota. Ask them to swap a shift." We don't hold anyone's pronouns. */
export function AskNote({ name }: { name: string | null }) {
  const ds = useDs();
  return (
    <View style={[styles.note, { backgroundColor: withAlpha(ds.c.ink, 0.06) }]}>
      <IconSymbol name="person.2.fill" size={19} color={ds.c.ink} />
      <Body style={styles.flex}>{name ? `${name} makes the rota. Ask them to swap a shift.` : 'Ask your manager to swap a shift.'}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  shrink: { flexShrink: 1 },
  end: { alignItems: 'flex-end', gap: 2 },
  strip: { flexDirection: 'row', gap: space.xs },
  day: { flex: 1, alignItems: 'center', gap: space.xs, paddingTop: space.sm + 2, paddingBottom: space.sm, borderRadius: radius.control + 4 },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  warn: { borderRadius: radius.card - 2, padding: space.md, paddingLeft: space.lg, gap: space.md },
  warnWide: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  warnLine: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  warnAction: { alignSelf: 'flex-start' },
  flex: { flex: 1 },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xl, maxWidth: 420, alignSelf: 'center', width: '100%' },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.card - 4 },
});
