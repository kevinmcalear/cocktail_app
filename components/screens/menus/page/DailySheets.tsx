import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Body, Caption, Field, GlassButton } from '@/components/ds';
import { PencilState } from '@/components/ds/PencilState';
import { space } from '@/constants/tokens';
import { useDailyDay, type MenuDayRow } from '@/hooks/useDailyList';
import { useEndedRuns, useListRows } from '@/hooks/useLivingList';
import { addDays, barDay, clockAt, dayText } from '@/lib/dailyList';
import type { MenuDetail, MenuDrink } from '@/types/menus';

import { MenuSheet } from '../MenuSheet';

type Names = (id: string | null) => string | null;

/** Note for the team: a line on today's list for whoever opens it (menu_days.note, 280 at most). */
export function DailyNoteSheet({ note, onSave, onClose }: { note: string | null; onSave: (note: string) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState(note ?? '');
  const save = async () => {
    try {
      await onSave(text);
      onClose();
    } catch {
      Alert.alert('That didn’t save. Check your connection and try again.');
    }
  };
  return (
    <MenuSheet visible onClose={onClose} title="Note for the team" save={{ label: 'Save', onPress: () => void save() }}>
      <Field label="Note" hideLabel value={text} onChangeText={setText} placeholder="Last Word while the Chartreuse lasts" maxLength={280} minLines={3} multiline autoFocus />
      <Caption tone="muted">Everyone at the bar sees it on today’s list. Tomorrow starts without it.</Caption>
    </MenuSheet>
  );
}

/**
 * Written by: who wrote today's list and when, and each switch since, the
 * latest first ("4:12pm · Sam put Bee's Knees on").
 */
export function DailyChangesSheet({ menu, day, today, timeZone, name, drinkName, onClose }: { menu: MenuDetail; day: MenuDayRow | null; today: string; timeZone: string | null; name: Names; drinkName: (id: string) => string; onClose: () => void }) {
  const rows = useListRows(menu.id).data ?? [];
  const ended = useEndedRuns(menu.id).data ?? [];
  const isToday = (iso: string | null) => !!iso && barDay(Date.parse(iso), timeZone) === today;
  const changes = [
    ...rows.filter((r) => isToday(r.onFrom)).map((r) => ({ at: r.onFrom!, text: `${name(r.addedBy) ?? 'Someone'} put ${drinkName(r.itemId)} on` })),
    ...ended.filter((r) => isToday(r.cameOff) && r.cameOff > r.wentOn).map((r) => ({ at: r.cameOff, text: `${name(r.takenOffBy) ?? 'Someone'} took ${drinkName(r.itemId)} off` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const writer = day ? name(day.writtenBy) : null;
  return (
    <MenuSheet visible onClose={onClose} title="Today’s list" subtitle={day ? `Written by ${writer ?? 'Someone'} at ${clockAt(day.writtenAt, timeZone)}` : 'Nobody has changed it today'}>
      {changes.length ? (
        changes.map((c) => (
          <View key={c.at + c.text} style={styles.change}>
            <Caption tone="muted" style={styles.time}>
              {clockAt(c.at, timeZone)}
            </Caption>
            <Body style={styles.grow}>{c.text}</Body>
          </View>
        ))
      ) : (
        <Body tone="muted">It’s yesterday’s list as it was. Switch a drink on or off to write today’s.</Body>
      )}
    </MenuSheet>
  );
}

/** Another day: the list as it was on any day before today, with who wrote it, a day at a time. */
export function DailyDaySheet({ menu, today, start, timeZone, name, onClose }: { menu: MenuDetail; today: string; start: string; timeZone: string | null; name: Names; onClose: () => void }) {
  const [day, setDay] = useState(start);
  const list = useDailyDay(menu.id, day);
  const first = menu.startsAt ? barDay(Date.parse(menu.startsAt), timeZone) : null;
  const atFirst = !!first && day <= first;
  const writer = list.day ? `Written by ${name(list.day.writtenBy) ?? 'Someone'} at ${clockAt(list.day.writtenAt, timeZone)}` : null;
  return (
    <MenuSheet
      visible
      onClose={onClose}
      title={dayText(day)}
      subtitle={[list.loading ? null : `${list.count} ${list.count === 1 ? 'drink' : 'drinks'}`, writer].filter(Boolean).join(' · ') || undefined}
      aside={
        <View style={styles.steps}>
          {atFirst ? null : <GlassButton icon="chevron.left" accessibilityLabel="The day before" onPress={() => setDay(addDays(day, -1))} />}
          {addDays(day, 1) >= today ? null : <GlassButton icon="chevron.right" accessibilityLabel="The day after" onPress={() => setDay(addDays(day, 1))} />}
        </View>
      }
    >
      {list.failed ? (
        <PencilState kind="error" compact title="Couldn’t load that day" action={{ label: 'Try again', onPress: list.retry }} />
      ) : list.loading ? (
        <PencilState kind="loading" compact title="Opening the list…" />
      ) : list.drinks.length ? (
        list.drinks.map((d: MenuDrink) => (
          <View key={d.id} style={styles.drink}>
            <Body>{d.name}</Body>
            {d.line ? <Caption tone="muted">{d.line}</Caption> : null}
          </View>
        ))
      ) : (
        <Body tone="muted">Nothing was on the list that day.</Body>
      )}
      {list.day?.note ? <Caption tone="muted">{`Note: ${list.day.note}`}</Caption> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  change: { flexDirection: 'row', gap: space.md, alignItems: 'baseline', paddingVertical: space.xs },
  time: { minWidth: 56 },
  grow: { flex: 1 },
  steps: { flexDirection: 'row', gap: space.sm },
  drink: { gap: 2, paddingVertical: space.xs },
});
