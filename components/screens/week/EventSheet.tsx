import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Chip, DateField, DsText, Field, PressableScale, Segmented, TimeField, useDs } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { SwitchRow } from '@/components/screens/settings/SettingsParts';
import { radius, space } from '@/constants/tokens';
import { useCreateMenu, useDeleteMenu } from '@/hooks/useMenuMutations';
import { useBarProfile } from '@/hooks/useRankings';
import { useSaveEvent, type SavedEvent } from '@/hooks/useWeek';
import { toDay } from '@/lib/collection';
import { blankSection } from '@/lib/menuLayout';
import { cleanTicketUrl, EVENT_KINDS, type EventKind } from '@/lib/week';

import { CalendarImport } from './CalendarImport';
import { EventGuest, type GuestValue } from './EventGuest';

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
  event?: SavedEvent;
  /** Adding from a day on the week page: that day (2026-10-14). */
  day?: string;
  /** Opens on "From a calendar link" (the week page's Calendar link button). */
  tab?: 'one' | 'link';
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
 * Add or change an event: what kind, who's the guest (a bar's page, or a
 * name), when, its menu (a new one for their drinks, or one you have), whether
 * the house menu is still on, a booking link, and who sees it. Team only until
 * someone opens it up; a private event never goes public.
 */
export function EventSheet({ visible, onClose, barId, menus, event, day, tab: firstTab = 'one', onSaved }: EventSheetProps) {
  const ds = useDs();
  const router = useRouter();
  const save = useSaveEvent();
  const createMenu = useCreateMenu();
  const deleteMenu = useDeleteMenu();
  const [today] = useState(() => toDay(new Date()));
  const [kind, setKind] = useState<EventKind>(event?.kind ?? 'takeover');
  const [name, setName] = useState(event?.name ?? '');
  const [guest, setGuest] = useState<GuestValue>({ profileId: event?.guest_profile_id ?? null, name: event?.guest_name ?? '' });
  const guestPage = useBarProfile(null, guest.profileId).data;
  // A new menu for the guest's drinks, made when the event saves.
  const [addDrinks, setAddDrinks] = useState(false);
  const [date, setDate] = useState(event ? toDay(new Date(event.starts_at)) : (day ?? today));
  const [start, setStart] = useState(event ? timeOf(event.starts_at) : '19:00');
  const [end, setEnd] = useState(event?.ends_at ? timeOf(event.ends_at) : '');
  const [menuId, setMenuId] = useState<string | null>(event?.menu_id ?? null);
  const [houseMenuOn, setHouseMenuOn] = useState(event?.house_menu_on ?? true);
  const [description, setDescription] = useState(event?.description ?? '');
  const [ticket, setTicket] = useState(event?.ticket_url ?? '');
  // An event from a calendar comes in Team only; its calendar's setting picks the choice when someone opens it to publish.
  const [isPublic, setIsPublic] = useState(event ? event.is_public || (!!event.source?.starts_public && event.kind !== 'private') : false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'one' | 'link'>(event ? 'one' : firstTab);

  const startsAt = new Date(`${date}T${start}`);
  const ticketUrl = cleanTicketUrl(ticket);
  const open = kind !== 'private' && isPublic;
  const hasGuest = kind === 'takeover' || kind === 'guest_shift';
  const guestName = hasGuest ? (guest.profileId ? (guestPage?.display_name ?? null) : guest.name.trim() || null) : null;
  const busy = save.isPending || createMenu.isPending;
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
    let made: string | null = null;
    try {
      if (addDrinks && !menuId) {
        // Their drinks go under their name, so the menu credits them.
        made = await createMenu.mutateAsync({
          barId,
          layout: { name: name.trim(), coverUrl: null, coverPosition: 50, sections: [blankSection(guestName ? `By ${guestName}` : 'Drinks')] },
        });
      }
      const id = await save.mutateAsync({
        id: event?.id,
        bar_id: barId,
        name: name.trim(),
        kind,
        starts_at: startsAt.toISOString(),
        ends_at: end ? endAt(date, start, end).toISOString() : null,
        is_public: open,
        house_menu_on: houseMenuOn,
        guest_profile_id: hasGuest ? guest.profileId : null,
        guest_name: hasGuest && !guest.profileId ? guest.name.trim() || null : null,
        description: description.trim() || null,
        ticket_url: ticketUrl,
        menu_id: made ?? menuId,
      });
      onSaved?.(id);
      onClose();
      if (made) router.push(`/menus/${made}` as Href);
    } catch (e) {
      // Don't leave the new menu behind when the event didn't save.
      if (made) deleteMenu.mutate(made);
      setError(e instanceof Error ? e.message : "Couldn't save the event. Try again.");
    }
  };

  const menuName = menus.find((m) => m.id === menuId)?.name;
  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title={event ? 'Edit event' : 'New event'}
      save={tab === 'one' ? { label: busy ? 'Saving…' : 'Save', onPress: submit, disabled: busy } : undefined}
      form
      footer={tab === 'one' && error ? <Caption tone="accent">{error}</Caption> : undefined}
    >
      {event ? null : <Segmented fill quiet accessibilityLabel="How" options={TABS} value={tab} onChange={setTab} />}
      {tab === 'link' ? <CalendarImport barId={barId} onDone={onClose} /> : null}
      <View style={[styles.form, tab === 'link' && styles.hidden]}>
        <View role="radiogroup" accessibilityLabel="Kind" style={styles.wrap}>
          {EVENT_KINDS.map((k) => (
            <Chip key={k.kind} label={k.label} selected={kind === k.kind} onPress={() => setKind(k.kind)} />
          ))}
        </View>
        {/* One grouped card for who, what and when, as the New event board draws it. */}
        <View style={[styles.card, { backgroundColor: ds.c.surface }]}>
          {hasGuest ? (
            <View style={[styles.cell, { borderBottomColor: ds.c.line }]}>
              <EventGuest bare value={guest} onChange={setGuest} placeholder={kind === 'takeover' ? 'Pale Moth' : 'Mara Q. from The Lantern Room'} />
            </View>
          ) : null}
          <View style={[styles.cell, { borderBottomColor: ds.c.line }]}>
            <Field bare label="Name" value={name} onChangeText={setName} placeholder={kind === 'guest_shift' ? 'Guest shift: Mara Q.' : 'Pale Moth takeover'} />
          </View>
          <View style={[styles.pair, styles.cell, { borderBottomColor: ds.c.line }]}>
            <View style={styles.flex}>
              <DateField bare label="When" value={date} onChange={setDate} min={event ? undefined : today} />
            </View>
            <View style={styles.flex}>
              <TimeField bare label="Time" value={start} onChange={setStart} />
            </View>
          </View>
          <View style={[styles.cell, styles.last]}>
            {end ? <TimeField bare label="Ends" value={end} onChange={setEnd} /> : null}
            <SwitchRow label="Runs late" detail="No set end time" value={!end} onValueChange={(late) => setEnd(late ? '' : '23:00')} />
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: ds.c.surface }]}>
          <PressableScale
            role="checkbox"
            aria-checked={addDrinks && !menuId}
            accessibilityLabel="Add drinks: a new menu for the night, credited to the guest"
            onPress={() => {
              setAddDrinks(!addDrinks || !!menuId);
              setMenuId(null);
            }}
            style={[styles.menuRow, styles.cell, { borderBottomColor: ds.c.line }]}
          >
            <View style={styles.flex}>
              <DsText>Menu</DsText>
              <Caption tone="muted">
                {menuName
                  ? `On ${menuName}`
                  : addDrinks
                    ? `A new menu opens after you save${guestName ? `, its drinks credited to ${guestName}` : ''}.`
                    : 'Optional. Their drinks, credited to them.'}
              </Caption>
            </View>
            <Caption tone={addDrinks && !menuId ? 'accent' : 'muted'}>{addDrinks && !menuId ? 'Adding drinks' : 'Add drinks'}</Caption>
          </PressableScale>
          {menus.length ? (
            <View role="radiogroup" accessibilityLabel="Or a menu you have" style={[styles.wrap, styles.cell, { borderBottomColor: ds.c.line }]}>
              <Caption tone="muted" style={styles.full}>
                Or a menu you have
              </Caption>
              {menus.map((m) => (
                <Choice
                  key={m.id}
                  label={m.name}
                  selected={menuId === m.id}
                  onPress={() => {
                    setMenuId(menuId === m.id ? null : m.id);
                    setAddDrinks(false);
                  }}
                />
              ))}
            </View>
          ) : null}
          <View style={[styles.cell, { borderBottomColor: ds.c.line }]}>
            <SwitchRow label="House menu still on" value={houseMenuOn} onValueChange={setHouseMenuOn} />
          </View>
          <View style={[styles.cell, { borderBottomColor: ds.c.line }]}>
            <Field bare label="Booking or ticket link" value={ticket} onChangeText={setTicket} placeholder="Resy, Eventbrite, Luma or any link" autoCapitalize="none" keyboardType="url" />
          </View>
          <View style={[styles.cell, styles.last]}>
            <Field bare label="For guests (optional)" value={description} onChangeText={setDescription} placeholder="Five Pale Moth drinks next to our menu. Walk-ins only." multiline />
          </View>
        </View>
        {kind === 'private' ? (
          <Caption tone="muted">Private events stay with your team.</Caption>
        ) : (
          <View role="radiogroup" accessibilityLabel="Who sees it" style={styles.who}>
            <Caption tone="muted">Who sees it</Caption>
            {event?.source && !event.is_public ? <Caption tone="muted">From your calendar: only your team sees it until you save it for Everyone.</Caption> : null}
            <View style={styles.pair}>
              <View style={styles.flex}>
                <Choice label="Everyone" detail="Your page, Discover, followers" selected={isPublic} onPress={() => setIsPublic(true)} />
              </View>
              <View style={styles.flex}>
                <Choice label="Team only" detail="Tonight and the sidebar" selected={!isPublic} onPress={() => setIsPublic(false)} />
              </View>
            </View>
          </View>
        )}
      </View>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  full: { width: '100%' },
  who: { gap: space.sm },
  // Hidden, not unmounted, so switching tabs keeps what's typed.
  form: { gap: space.md },
  hidden: { display: 'none' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  card: { borderRadius: radius.card - 6, borderCurve: 'continuous', paddingHorizontal: space.md + 2 },
  cell: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, gap: space.xs },
  last: { borderBottomWidth: 0 },
  pair: { flexDirection: 'row', gap: space.md },
});
