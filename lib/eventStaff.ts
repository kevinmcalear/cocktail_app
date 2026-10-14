import type { WeekItem } from '@/lib/week';

/**
 * Behind the bar (20261016500000_event_staff.sql): who works an event, as
 * week_event_staff returns it. The server leaves out the name of anyone whose
 * own choices keep them off public pages; this file only words what it gets.
 */

/** One person behind the bar. Plain JSON. */
export interface EventStaffRow {
  id: string;
  eventId: string;
  /** The teammate's account, for the bar's team only. */
  userId: string | null;
  /** Null when the person isn't shown to this reader. */
  name: string | null;
  isGuest: boolean;
  /** Their public profile, when there is one to open. */
  profileId: string | null;
  sortOrder: number;
}

export interface StaffRpcRow {
  event_id: string;
  id: string;
  user_id: string | null;
  name: string | null;
  is_guest: boolean;
  profile_id: string | null;
  sort_order: number;
}

export const toStaffRow = (r: StaffRpcRow): EventStaffRow => ({
  id: r.id,
  eventId: r.event_id,
  userId: r.user_id,
  name: r.name,
  isGuest: r.is_guest,
  profileId: r.profile_id,
  sortOrder: r.sort_order,
});

/** "Sam Ortiz" to "Sam O.", as the boards write people on a public page. A typed "Mara Q." stays as it is. */
export function shortName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words[0] ?? '';
  const last = words[words.length - 1];
  return /^\p{L}\.?$/u.test(last) ? words.join(' ') : `${words[0]} ${last[0].toUpperCase()}.`;
}

export interface StaffChip {
  key: string;
  /** "Jun A., Pale Moth", or "Little Rye team" for people who aren't shown. */
  label: string;
  /** Read aloud: the full name where there is one. */
  spoken: string;
  /** For the initials, when it's a person. */
  person: string | null;
  profileId: string | null;
}

/**
 * The chips under Behind the bar: each named person as "Jun A., Pale Moth"
 * (guests from the guest bar, when the event has one; teammates from the
 * host), then one chip each for the teammates and the guests who aren't shown,
 * by their side only ("Little Rye team", "2 guest bartenders").
 */
export function staffChips(rows: EventStaffRow[], { barName, guestBar }: { barName: string | null; guestBar: string | null }): StaffChip[] {
  const chips: StaffChip[] = [];
  for (const r of rows) {
    if (!r.name) continue;
    const from = r.isGuest ? guestBar : barName;
    const short = shortName(r.name);
    chips.push({ key: r.id, label: from ? `${short}, ${from}` : short, spoken: from ? `${r.name}, ${from}` : r.name, person: short, profileId: r.profileId });
  }
  const team = rows.filter((r) => !r.name && !r.isGuest).length;
  const guests = rows.filter((r) => !r.name && r.isGuest).length;
  if (team) {
    const side = barName ? `${barName} team` : 'the team';
    const label = team === 1 ? side[0].toUpperCase() + side.slice(1) : `${team} from ${barName ?? 'the team'}`;
    chips.push({ key: 'team', label, spoken: label, person: null, profileId: null });
  }
  if (guests) {
    const label = guests === 1 ? 'Guest bartender' : `${guests} guest bartenders`;
    chips.push({ key: 'guests', label, spoken: label, person: null, profileId: null });
  }
  return chips;
}

/**
 * A guest shift's line in the week names its guest bartenders: "Mara Q. from
 * The Lantern Room" when the guest is a bar's page, "Mara Q." when the event
 * names no guest. A guest the venue typed in ("Mara Q. from The Lantern Room")
 * already says it, so it stays.
 */
export function withGuestStaff(items: WeekItem[], rows: EventStaffRow[]): WeekItem[] {
  if (!rows.length) return items;
  return items.map((i) => {
    if (i.kind !== 'event' || i.eventKind !== 'guest_shift' || (i.guestName && !i.guestProfileId)) return i;
    const names = rows.filter((r) => r.eventId === i.id && r.isGuest && r.name).map((r) => shortName(r.name!));
    if (!names.length) return i;
    const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return { ...i, guestName: i.guestName ? `${who} from ${i.guestName}` : who };
  });
}

/** Events in a week whose line can name guest bartenders: only those are asked about. */
export const guestShiftIds = (items: WeekItem[]) =>
  items.filter((i) => i.kind === 'event' && i.eventKind === 'guest_shift' && !(i.guestName && !i.guestProfileId)).map((i) => i.id);
