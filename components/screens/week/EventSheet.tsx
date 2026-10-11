import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Chip, DateField, DsText, Field, PressableScale, TimeField, useDs } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { SwitchRow } from '@/components/screens/settings/SettingsParts';
import { radius, space } from '@/constants/tokens';
import { useCreateMenu, useDeleteMenu } from '@/hooks/useMenuMutations';
import { useBarProfile } from '@/hooks/useRankings';
import { useSaveEvent, type EventDraft } from '@/hooks/useWeek';
import { toDay } from '@/lib/collection';
import { blankSection } from '@/lib/menuLayout';
import { cleanTicketUrl, EVENT_KINDS, type EventKind } from '@/lib/week';

import { EventGuest, type GuestValue } from './EventGuest';

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
 * Add or change an event: what kind, who's the guest (a bar's page, or a
 * name), when, its menu (a new one for their drinks, or one you have), whether
 * the house menu is still on, a booking link, and who sees it. Team only until
 * someone opens it up; a private event never goes public.
 */
export function EventSheet({ visible, onClose, barId, menus, event, day, onSaved }: EventSheetProps) {
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
  const [isPublic, setIsPublic] = useState(event?.is_public ?? false);
  const [error, setError] = useState<string | null>(null);

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
      save={{ label: busy ? 'Saving…' : 'Save', onPress: submit, disabled: busy }}
      footer={error ? <Caption tone="accent">{error}</Caption> : undefined}
    >
      <View role="radiogroup" accessibilityLabel="Kind" style={styles.wrap}>
        {EVENT_KINDS.map((k) => (
          <Chip key={k.kind} label={k.label} selected={kind === k.kind} onPress={() => setKind(k.kind)} />
        ))}
      </View>
      {hasGuest ? <EventGuest value={guest} onChange={setGuest} placeholder={kind === 'takeover' ? 'Pale Moth' : 'Mara Q. from The Lantern Room'} /> : null}
      <Field label="Name" value={name} onChangeText={setName} placeholder={kind === 'guest_shift' ? 'Guest shift: Mara Q.' : 'Pale Moth takeover'} />
      <DateField label="Day" value={date} onChange={setDate} min={event ? undefined : today} />
      <TimeField label="Starts" value={start} onChange={setStart} />
      <SwitchRow label="Runs late" detail="No set end time" value={!end} onValueChange={(late) => setEnd(late ? '' : '23:00')} />
      {end ? <TimeField label="Ends" value={end} onChange={setEnd} /> : null}
      <PressableScale
        role="checkbox"
        aria-checked={addDrinks && !menuId}
        accessibilityLabel="Add drinks: a new menu for the night, credited to the guest"
        onPress={() => {
          setAddDrinks(!addDrinks || !!menuId);
          setMenuId(null);
        }}
        style={[styles.menuRow, { backgroundColor: ds.c.surface }]}
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
        <View role="radiogroup" accessibilityLabel="Or a menu you have" style={styles.wrap}>
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
          <Caption tone="muted">Who sees it</Caption>
          <Choice label="Everyone" detail="Your page, Discover, followers" selected={isPublic} onPress={() => setIsPublic(true)} />
          <Choice label="Team only" detail="Tonight and the sidebar" selected={!isPublic} onPress={() => setIsPublic(false)} />
        </View>
      )}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  full: { width: '100%' },
  who: { gap: space.sm },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
});
