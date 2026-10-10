import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, DateField, Field, Segmented, TimeField } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { SwitchRow } from '@/components/screens/settings/SettingsParts';
import { space } from '@/constants/tokens';
import { useSaveEvent, type EventDraft } from '@/hooks/useWeek';
import { toDay } from '@/lib/collection';
import { cleanTicketUrl, EVENT_KINDS, type EventKind } from '@/lib/week';

import { CalendarImport } from './CalendarImport';

const TABS = [
  { value: 'one', label: 'Add one' },
  { value: 'link', label: 'From a calendar link' },
] as const;

interface MenuOption {
  id: string;
  name: string;
}

interface EventSheetProps {
  visible: boolean;
  onClose: () => void;
  barId: string;
  menus: MenuOption[];
  /** Editing: the event as saved. Adding: undefined. */
  event?: EventDraft;
  /** Adding from a day on the week page: that day (2026-10-14). */
  day?: string;
  onSaved?: (id: string) => void;
}

const two = (n: number) => String(n).padStart(2, '0');
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** An end before the start runs past midnight: it ends the next morning. */
function endAt(day: string, start: string, end: string): Date {
  const d = new Date(`${day}T${end}`);
  if (end <= start) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Add or change an event: what kind, who's the guest, when, its menu, whether
 * the house menu is still on, a booking link, and who sees it. Team only until
 * someone opens it up; a private event never goes public.
 */
export function EventSheet({ visible, onClose, barId, menus, event, day, onSaved }: EventSheetProps) {
  const save = useSaveEvent();
  const [today] = useState(() => toDay(new Date()));
  const [kind, setKind] = useState<EventKind>(event?.kind ?? 'takeover');
  const [name, setName] = useState(event?.name ?? '');
  const [guest, setGuest] = useState(event?.guest_name ?? '');
  const [date, setDate] = useState(event ? toDay(new Date(event.starts_at)) : (day ?? today));
  const [start, setStart] = useState(event ? timeOf(event.starts_at) : '19:00');
  const [end, setEnd] = useState(event?.ends_at ? timeOf(event.ends_at) : '');
  const [menuId, setMenuId] = useState<string | null>(event?.menu_id ?? null);
  const [houseMenuOn, setHouseMenuOn] = useState(event?.house_menu_on ?? true);
  const [description, setDescription] = useState(event?.description ?? '');
  const [ticket, setTicket] = useState(event?.ticket_url ?? '');
  const [isPublic, setIsPublic] = useState(event?.is_public ?? false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'one' | 'link'>('one');

  const startsAt = new Date(`${date}T${start}`);
  const ticketUrl = cleanTicketUrl(ticket);
  const open = kind !== 'private' && isPublic;
  const problem = !name.trim()
    ? 'Give the event a name.'
    : Number.isNaN(startsAt.getTime())
      ? 'Pick a day and a start time.'
      : ticket.trim() && !ticketUrl
        ? "That booking link doesn't look like a web address."
        : null;

  const submit = async () => {
    if (problem) return setError(problem);
    setError(null);
    try {
      const id = await save.mutateAsync({
        id: event?.id,
        bar_id: barId,
        name: name.trim(),
        kind,
        starts_at: startsAt.toISOString(),
        ends_at: end ? endAt(date, start, end).toISOString() : null,
        is_public: open,
        house_menu_on: houseMenuOn,
        guest_name: guest.trim() || null,
        description: description.trim() || null,
        ticket_url: ticketUrl,
        menu_id: menuId,
      });
      onSaved?.(id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the event. Try again.");
    }
  };

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title={event ? 'Edit event' : 'New event'}
      footer={
        tab === 'one' ? (
          <>
            {error ? <Caption tone="accent">{error}</Caption> : null}
            <Button label={save.isPending ? 'Saving…' : event ? 'Save' : 'Add event'} onPress={submit} disabled={save.isPending} />
          </>
        ) : undefined
      }
    >
      {event ? null : <Segmented accessibilityLabel="How" options={TABS} value={tab} onChange={setTab} />}
      {tab === 'link' ? (
        <CalendarImport barId={barId} onDone={onClose} />
      ) : (
        <>
          <View role="radiogroup" accessibilityLabel="Kind" style={styles.wrap}>
            {EVENT_KINDS.map((k) => (
              <Chip key={k.kind} label={k.label} selected={kind === k.kind} onPress={() => setKind(k.kind)} />
            ))}
          </View>
          {kind === 'takeover' || kind === 'guest_shift' ? (
            <Field label="Guest" value={guest} onChangeText={setGuest} placeholder={kind === 'takeover' ? 'Pale Moth' : 'Mara Q. from The Lantern Room'} />
          ) : null}
          <Field label="Name" value={name} onChangeText={setName} placeholder={kind === 'guest_shift' ? 'Guest shift: Mara Q.' : 'Pale Moth takeover'} />
          <DateField label="Day" value={date} onChange={setDate} min={event ? undefined : today} />
          <TimeField label="Starts" value={start} onChange={setStart} />
          <SwitchRow label="Runs late" detail="No set end time" value={!end} onValueChange={(late) => setEnd(late ? '' : '23:00')} />
          {end ? <TimeField label="Ends" value={end} onChange={setEnd} /> : null}
          {menus.length ? (
            <View role="radiogroup" accessibilityLabel="Menu" style={styles.wrap}>
              <Caption tone="muted" style={styles.full}>
                Menu for the night (optional)
              </Caption>
              <Choice label="None" selected={menuId === null} onPress={() => setMenuId(null)} />
              {menus.map((m) => (
                <Choice key={m.id} label={m.name} selected={menuId === m.id} onPress={() => setMenuId(m.id)} />
              ))}
            </View>
          ) : null}
          <SwitchRow label="House menu still on" detail="Guests ask when a takeover swaps the whole list." value={houseMenuOn} onValueChange={setHouseMenuOn} />
          <Field
            label="For guests (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Five Pale Moth drinks next to our menu. Walk-ins only."
            multiline
          />
          <Field
            label="Booking or ticket link (optional)"
            value={ticket}
            onChangeText={setTicket}
            placeholder="Resy, Eventbrite, Luma or any link"
            autoCapitalize="none"
            keyboardType="url"
          />
          {kind === 'private' ? (
            <Caption tone="muted">Private events stay with your team.</Caption>
          ) : (
            <View role="radiogroup" accessibilityLabel="Who sees it" style={styles.who}>
              <Choice label="Team only" detail="Tonight and This week, for your team" selected={!isPublic} onPress={() => setIsPublic(false)} />
              <Choice label="Everyone" detail="Your bar page, Discover and people who love your bar" selected={isPublic} onPress={() => setIsPublic(true)} />
            </View>
          )}
        </>
      )}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  full: { width: '100%' },
  who: { gap: space.sm },
});
