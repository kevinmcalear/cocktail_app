import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DateField, DsText, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useScheduleMenu } from '@/hooks/useMenuMutations';
import { menuReadiness, newDrinkCount, plural } from '@/lib/menus';
import type { MenuDetail, MenuSummary } from '@/types/menus';

import { Choice, MenuSheet } from './MenuSheet';

type When = 'now' | 'tomorrow' | 'date';

interface GoLiveSheetProps {
  visible: boolean;
  onClose: () => void;
  menu: Pick<MenuDetail, 'id' | 'name' | 'barId' | 'sections'>;
  /** The venue's other menus that are on now or coming up: the ones this can replace. */
  others: MenuSummary[];
  onDone: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** When a menu goes on: the start of that day, local time. */
function startFor(when: When, date: string, now: number): Date | null {
  if (when === 'now') return null;
  const d = when === 'tomorrow' ? new Date(now + 86_400_000) : new Date(`${date}T00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function Line({ mark, tone, children }: { mark: string; tone: 'ok' | 'warn' | 'info'; children: string }) {
  const ds = useDs();
  const color = tone === 'ok' ? ds.c.ink : tone === 'warn' ? ds.accentText : ds.c.muted;
  return (
    <View style={[styles.line, { borderBottomColor: ds.c.line }]}>
      <DsText variant="spec" color={color} accessibilityElementsHidden importantForAccessibility="no">
        {mark}
      </DsText>
      <Body style={styles.flex}>{children}</Body>
    </View>
  );
}

/**
 * Putting a menu on: now or on a date, whether it replaces what's on, and
 * what to know first. Short sections stop it; missing photos and prices don't.
 */
export function GoLiveSheet({ visible, onClose, menu, others, onDone }: GoLiveSheetProps) {
  const [when, setWhen] = useState<When>('now');
  const [date, setDate] = useState(() => ymd(new Date(Date.now() + 7 * 86_400_000)));
  const [replaceIds, setReplaceIds] = useState<string[]>([]);
  const [now] = useState(() => Date.now());
  const schedule = useScheduleMenu();
  const [error, setError] = useState<string | null>(null);

  const ready = menuReadiness(menu);
  const itemIds = menu.sections.flatMap((s) => s.drinks.map((d) => d.id));
  const fresh = newDrinkCount(itemIds, others);
  const start = startFor(when, date, now);
  const dateLabel = start?.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const badDate = when === 'date' && !start;
  const toggle = (id: string) => setReplaceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async () => {
    if (badDate) return setError('Pick a day.');
    setError(null);
    try {
      await schedule.mutateAsync({ menuId: menu.id, startsAt: start?.toISOString() ?? null, replaceIds });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t put the menu on. Try again.');
    }
  };

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title={`Put ${menu.name} on`}
      footer={
        <Button
          size="lg"
          label={schedule.isPending ? 'Saving…' : start ? `Schedule for ${dateLabel}` : 'Put it on now'}
          onPress={submit}
          disabled={!ready.canGoLive || schedule.isPending || badDate}
        />
      }
    >
      <Caption tone="muted">When</Caption>
      <View role="radiogroup" accessibilityLabel="When" style={styles.wrap}>
        <Choice label="Now" selected={when === 'now'} onPress={() => setWhen('now')} />
        <Choice label="Tomorrow" selected={when === 'tomorrow'} onPress={() => setWhen('tomorrow')} />
        <Choice label="Pick a date" selected={when === 'date'} onPress={() => setWhen('date')} />
      </View>
      {when === 'date' ? <DateField label="Date" value={date} onChange={setDate} min={ymd(new Date(now))} hint="It goes on at the start of that day." /> : null}

      {others.length ? (
        <>
          <Caption tone="muted">Take off when this goes on</Caption>
          <View style={styles.list}>
            {others.map((m) => (
              <Choice
                key={m.id}
                kind="checkbox"
                label={m.name}
                detail={
                  m.startsAt && Date.parse(m.startsAt) > now
                    ? replaceIds.includes(m.id) ? 'Coming up: ends when this starts' : 'Coming up: keeps its date'
                    : replaceIds.includes(m.id) ? 'Moves to Previous' : 'Stays on alongside it'
                }
                selected={replaceIds.includes(m.id)}
                onPress={() => toggle(m.id)}
              />
            ))}
          </View>
        </>
      ) : null}

      <Caption tone="muted">Before it goes on</Caption>
      <View>
        {ready.short.map((s) => (
          <Line key={s.name} mark="!" tone="warn">{`${s.name} needs ${plural(s.needed, 'more drink')}`}</Line>
        ))}
        {ready.over.map((s) => (
          <Line key={s.name} mark="!" tone="warn">{`${s.name} has ${plural(s.extra, 'drink')} too many`}</Line>
        ))}
        {!ready.short.length && !ready.over.length ? (
          <Line mark="✓" tone="ok">{itemIds.length ? 'Every section has the drinks it needs' : 'Add some drinks first'}</Line>
        ) : null}
        {ready.needsPhoto.length ? (
          <Line mark="!" tone="info">{`${ready.needsPhoto.slice(0, 2).join(' and ')}${ready.needsPhoto.length > 2 ? ` and ${ready.needsPhoto.length - 2} more` : ''} still need${ready.needsPhoto.length === 1 ? 's' : ''} a photo`}</Line>
        ) : null}
        {ready.noPrice.length ? <Line mark="!" tone="info">{`${plural(ready.noPrice.length, 'drink')} with no price`}</Line> : null}
        {fresh && menu.barId ? <Line mark="→" tone="info">{`${plural(fresh, 'drink')} new to the team: ${fresh === 1 ? 'it’s' : 'they’re'} in Study once it’s on`}</Line> : null}
      </View>
      {error ? <Body tone="accent">{error}</Body> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: { gap: space.sm },
  line: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
});
