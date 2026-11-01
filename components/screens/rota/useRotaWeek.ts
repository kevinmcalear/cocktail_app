import { useState } from 'react';

import { useUserId } from '@/ctx/AuthContext';
import { useBarMembers, type BarMember } from '@/hooks/useBarDetail';
import { useBarFacts } from '@/hooks/useBarFacts';
import { useShifts, type Shift } from '@/hooks/useRota';
import { useVenueProfileId } from '@/hooks/useVenueRoles';
import { addDays, daysOfWeek, mondayOf, nextShifts, nightOf, noClose, rotaMaker, weekWindow } from '@/lib/rota';
import { roleLabel } from '@/lib/roles';

const HOUR = 3_600_000;
/** How far ahead a bartender's next shifts are read: far enough to find three on a quiet rota. */
const AHEAD_DAYS = 28;

export interface RotaPerson {
  user_id: string;
  name: string;
  /** "Head bartender", the venue's own role, else the level's name. */
  role: string;
  member: BarMember;
}

const personOf = (m: BarMember): RotaPerson => ({ user_id: m.user_id, name: m.display_name?.trim() || 'Someone', role: m.venue_role_name ?? roleLabel(m.role_level), member: m });

/**
 * One week of the rota in the bar's own time, and what the screen needs round
 * it: the week before and after for copying, your next shifts, the team.
 */
export function useRotaWeek(barId: string, edit: boolean) {
  const me = useUserId();
  const profile = useVenueProfileId(barId);
  const facts = useBarFacts(profile.data);
  // The week's window depends on the bar's zone: wait for it rather than read twice.
  const settled = !profile.isLoading && !facts.isLoading;
  const timeZone = facts.data?.timezone ?? null;
  const [now] = useState(() => new Date());
  const today = nightOf(now, timeZone);
  const thisWeek = mondayOf(today);
  const [week, setWeek] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const shown = week ?? thisWeek;
  const selected = picked && mondayOf(picked) === shown ? picked : shown === thisWeek ? today : shown;

  const bar = settled ? barId : null;
  const w = weekWindow(shown, timeZone);
  const before = weekWindow(addDays(shown, -7), timeZone);
  const after = weekWindow(addDays(shown, 7), timeZone);
  const current = useShifts(bar, w.from, w.to);
  const last = useShifts(edit ? bar : null, before.from, before.to);
  const next = useShifts(edit ? bar : null, after.from, after.to);
  // To the hour, so the key holds still.
  const hour = Math.floor(now.getTime() / HOUR) * HOUR;
  const ahead = useShifts(bar, new Date(hour).toISOString(), new Date(hour + AHEAD_DAYS * 24 * HOUR).toISOString()).data;

  const days = daysOfWeek(current.data ?? [], shown, timeZone);
  const shifts: Shift[] = days.flatMap((d) => d.shifts);
  const members = useBarMembers(barId).data;
  const people = (members ?? []).map(personOf);
  const person = (id: string) => people.find((p) => p.user_id === id);
  const nameOf = (id: string) => person(id)?.name ?? 'Someone';
  const maker = rotaMaker(shifts);

  return {
    me,
    timeZone,
    hours: facts.data?.hours ?? null,
    today,
    thisWeek,
    week: shown,
    goToWeek: (monday: string) => {
      setWeek(monday);
      setPicked(null);
    },
    selected,
    pick: setPicked,
    days,
    /** The week's shifts, each on a night of the week. */
    shifts,
    loading: !settled || current.isLoading,
    failed: current.isError && !current.data,
    retry: () => void current.refetch(),
    gaps: noClose(days, today),
    people,
    person,
    nameOf,
    /** Who to ask for a swap, by first name. */
    maker: maker ? nameOf(maker).split(' ')[0] : null,
    /** Your next shifts, from the coming weeks. */
    mine: nextShifts({ shifts: ahead ?? [], me, today, nameOf, timeZone }),
    lastWeek: last.data ? daysOfWeek(last.data, addDays(shown, -7), timeZone).flatMap((d) => d.shifts) : null,
    nextWeek: next.data ? daysOfWeek(next.data, addDays(shown, 7), timeZone).flatMap((d) => d.shifts) : null,
  };
}

export type RotaWeek = ReturnType<typeof useRotaWeek>;
