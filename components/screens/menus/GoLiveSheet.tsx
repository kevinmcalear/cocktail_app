import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, DateField } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useScheduleMenu } from '@/hooks/useMenuMutations';
import { menuReadiness, newDrinkCount, plural } from '@/lib/menus';
import type { MenuDetail, MenuSummary } from '@/types/menus';

import { AnswerRow } from '../addDrink/ReviewStep';
import { Eyebrow } from '../addDrink/WizardChrome';
import { Choice, MenuSheet } from './MenuSheet';
import { CardHeader, Check, ReadyChecks } from './ReviewParts';

type When = 'now' | 'tomorrow' | 'date';

interface GoLiveSheetProps {
  visible: boolean;
  onClose: () => void;
  menu: Pick<MenuDetail, 'id' | 'name' | 'barId' | 'sections' | 'coverUrl' | 'coverPosition'>;
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

/**
 * Putting a menu on, as a review step like the add-drink wizard's: the menu
 * on paper at the top, then its answers (when, what it takes off, its
 * drinks), each opening its choices in place, then what to know first.
 * Short sections stop it; missing photos and prices don't.
 */
export function GoLiveSheet({ visible, onClose, menu, others, onDone }: GoLiveSheetProps) {
  const [when, setWhen] = useState<When>('now');
  const [date, setDate] = useState(() => ymd(new Date(Date.now() + 7 * 86_400_000)));
  const [replaceIds, setReplaceIds] = useState<string[]>([]);
  const [now] = useState(() => Date.now());
  const schedule = useScheduleMenu();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<'when' | 'others' | null>(null);
  const flip = (row: 'when' | 'others') => setOpen((o) => (o === row ? null : row));

  const ready = menuReadiness(menu);
  const itemIds = menu.sections.flatMap((s) => s.drinks.map((d) => d.id));
  const fresh = newDrinkCount(itemIds, others);
  const start = startFor(when, date, now);
  const dateLabel = start?.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const badDate = when === 'date' && !start;
  const drinks = menu.sections.flatMap((s) => s.drinks);
  const whenLabel = when === 'now' ? 'Now' : start ? `${when === 'tomorrow' ? 'Tomorrow, ' : ''}${dateLabel}` : 'Pick a day';
  const offLabel = replaceIds.length ? others.filter((m) => replaceIds.includes(m.id)).map((m) => m.name).join(', ') : 'Nothing: the others stay as they are';
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
      <CardHeader name={menu.name} when={start ? `From ${dateLabel}` : 'From today'} coverUrl={menu.coverUrl} coverPosition={menu.coverPosition} drinks={drinks} />
      <View role="list">
        <AnswerRow label="When" value={whenLabel} onPress={() => flip('when')} hint="Shows the choices" />
        {open === 'when' ? (
          <View style={styles.open}>
            <View role="radiogroup" accessibilityLabel="When" style={styles.wrap}>
              <Choice label="Now" selected={when === 'now'} onPress={() => setWhen('now')} />
              <Choice label="Tomorrow" selected={when === 'tomorrow'} onPress={() => setWhen('tomorrow')} />
              <Choice label="Pick a date" selected={when === 'date'} onPress={() => setWhen('date')} />
            </View>
            {when === 'date' ? <DateField label="Date" value={date} onChange={setDate} min={ymd(new Date(now))} hint="It goes on at the start of that day." /> : null}
          </View>
        ) : null}
        {others.length ? <AnswerRow label="Takes off" value={offLabel} onPress={() => flip('others')} hint="Shows the menus it can replace" /> : null}
        {others.length && open === 'others' ? (
          <View style={[styles.open, styles.list]}>
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
        ) : null}
        <AnswerRow label="Drinks" value={`${plural(itemIds.length, 'drink')} in ${plural(menu.sections.length, 'section')}`} onPress={onClose} hint="Back to the menu to change them" opens />
      </View>

      <View>
        <Eyebrow>Before it goes on</Eyebrow>
        <ReadyChecks sections={menu.sections} home={false} />
        {fresh && menu.barId ? <Check done label={`${plural(fresh, 'drink')} new to the team`} note={`${fresh === 1 ? 'It’s' : 'They’re'} in Study once the menu is on.`} /> : null}
      </View>
      {error ? <Body tone="accent">{error}</Body> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: { gap: space.sm },
  open: { gap: space.md, paddingVertical: space.md },
});
