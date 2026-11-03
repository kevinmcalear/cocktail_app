import { useState } from 'react';

import { useUserId } from '@/ctx/AuthContext';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useListAsks, useListNotices, useOffTonight } from '@/hooks/useListAsks';
import { useBarClock, useEndedRuns, type ListRow } from '@/hooks/useLivingList';
import { afterTonight } from '@/lib/barHours';
import { ROLE_LEVELS } from '@/lib/roles';
import { useShifts } from '@/hooks/useRota';
import { useMenuLibrary } from '@/hooks/useMenuMutations';
import type { MenuDetail } from '@/types/menus';

import { liveList, type LiveSection } from './liveList';
import { dayMonth } from '@/lib/dayMonth';

const day = (iso: string) => dayMonth(new Date(iso), { month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const CREATOR = ROLE_LEVELS.find((r) => r.label === 'Drink Creator')!.level;

/**
 * The team's view of a list that's on (liveList), with what it reads: runs
 * ended, asks, who asked, drinks off tonight, the drinks taken off. Off: the
 * sections as they are.
 */
export function useLiveSections({
  menu,
  sections,
  rows,
  may,
  on,
  bartender,
  living,
  now,
}: {
  menu: MenuDetail;
  sections: LiveSection[];
  rows: ListRow[];
  may: boolean;
  on: boolean;
  bartender: boolean;
  living: boolean;
  now: number;
}) {
  const userId = useUserId();
  const ended = useEndedRuns(on ? menu.id : null).data ?? [];
  const asks = useListAsks(on ? menu.id : null).data ?? [];
  const off = useOffTonight(on ? menu.barId : null).data ?? [];
  // Names: who asked, and for a bartender who approves (the banner's "Alex or Kim").
  const members = useBarMembers(on && (bartender || asks.length > 0 || rows.some((r) => r.state.startsWith('waiting'))) ? menu.barId : null).data ?? [];
  // Team · told at: the last change told today (Menu-l-swapped).
  const [today] = useState(() => new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  const told = useListNotices(on && !bartender ? menu.barId : null, today).data?.find((n) => n.menuId === menu.id);
  // Names for drinks that left: today's struck rows, and the one a swap replaced in Last change.
  const library = useMenuLibrary(menu.barId, on && ended.length > 0).data ?? [];
  // Anyone on shift (now, or starting within two hours) pulls a drink for tonight, as the database lets them.
  const [soon] = useState(() => [new Date(now).toISOString(), new Date(now + 2 * 3_600_000).toISOString()] as const);
  const onShift = (useShifts(on && bartender ? menu.barId : null, soon[0], soon[1]).data ?? []).some((s) => s.user_id === userId);
  const clock = useBarClock(on && asks.some((a) => a.at) ? menu.barId : null).data;
  const first = (id: string | null) => members.find((m) => m.user_id === id)?.display_name?.split(' ')[0] ?? null;
  // ponytail: Drink Creators and up approve (as menuLens reads them); a list's own change level (menus.change_level) isn't read here.
  const approvers = members.filter((m) => m.role_level >= CREATOR && m.user_id !== userId).map((m) => first(m.user_id)).filter((n): n is string => !!n);
  const few = approvers.slice(0, 3);
  const approvedBy = few.length > 1 ? `${few.slice(0, -1).join(', ')} or ${few[few.length - 1]}` : (few[0] ?? null);
  if (!on) return { lead: null, main: sections, coming: null, lastChange: null, ended, toldAt: null, approvedBy: null };
  return {
    ...liveList({
      sections,
      sectionIds: new Map(menu.sections.map((s) => [s.name, s.id])),
      rows,
      ended,
      endedDrinks: new Map(library.filter((d) => ended.some((e) => e.itemId === d.id)).map((d) => [d.id, d])),
      may,
      bartender,
      asks,
      offTonight: off.filter((o) => o.menuId === menu.id && Date.parse(o.until) > now),
      pullsTonight: (may && !bartender) || onShift,
      closesAt: clock ? afterTonight(clock.hours, new Date(now), clock.timezone).toISOString() : null,
      living,
      userId,
      nameOf: (id) => (id === userId ? 'You' : first(id)),
      day,
      time,
      listStart: menu.startsAt,
      now,
    }),
    ended,
    toldAt: told ? `told at ${time(told.at)}` : null,
    approvedBy,
  };
}
