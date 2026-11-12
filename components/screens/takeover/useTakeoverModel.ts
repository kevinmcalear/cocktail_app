import { useMemo, useState } from 'react';

import { useBarMembers } from '@/hooks/useBarDetail';
import { useBarInvites } from '@/hooks/useBarInvites';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useOffTonight } from '@/hooks/useListAsks';
import { useMenu, useVenueMenus } from '@/hooks/useMenus';
import { useRunSheet } from '@/hooks/useRunSheet';
import { useListMakers, useTakeoverHead } from '@/hooks/useTakeoverPage';
import { useRoleMatrix } from '@/hooks/useVenueRoles';
import { useWeekEvent, useWeekEventBrand } from '@/hooks/useWeek';
import { partyHues } from '@/constants/tokens';
import { isHexColor } from '@/lib/color';
import { groupMenus } from '@/lib/menus';
import { buildRunSheet, type RunSheet } from '@/lib/runSheet';
import { accessEnds, firstName, houseTonight, nightWhen, stillOpen } from '@/lib/takeover';

import type { Mark } from './parts';

export interface GuestBartender {
  key: string;
  name: string;
  /** "Access ends Fri 7 Nov, 4am", or "Invited · access ends …" before they join. */
  line: string;
}

/**
 * Everything the takeover page shows (board Kept-takeover), from what the app
 * already reads: the list and its night, the run sheet (its parties, drinks
 * and counts), the house list on beside it and what is off tonight, and the
 * people on the takeover's guest role.
 */
export function useTakeoverModel(menuId: string) {
  const head = useTakeoverHead(menuId);
  const run = useRunSheet(menuId);
  const h = head.data ?? null;
  const barId = h?.barId ?? run.data?.menu.barId ?? null;
  const event = useWeekEvent(h?.eventId).data;
  const brand = useWeekEventBrand(h?.eventId).data;
  const caps = useCapabilities(barId).data;
  const can = (c: string) => Array.isArray(caps) && caps.includes(c);
  const staff = can('staff');
  const members = useBarMembers(staff ? barId : null).data;
  const invites = useBarInvites(barId ?? '', staff && !!barId).data;
  const matrix = useRoleMatrix(staff ? barId : null).data;
  const venueMenus = useVenueMenus(barId).data;
  const [now] = useState(() => Date.now());
  const house = useMemo(
    () => groupMenus((venueMenus ?? []).filter((m) => m.barId === barId && m.id !== menuId && m.listType !== 'takeover'), now).on[0] ?? null,
    [venueMenus, barId, menuId, now],
  );
  const houseDetail = useMenu(house?.id).data;
  const off = useOffTonight(house ? barId : null).data;

  const data = run.data;
  const hostName = data?.menu.hostName ?? event?.barName ?? '';
  const guest = data?.parties.find((p) => p.kind === 'guest') ?? null;
  const guestName = guest?.name ?? event?.guestName ?? null;
  const title = guestName && hostName ? `${guestName} at ${hostName}` : (h?.name ?? data?.menu.name ?? 'Takeover');
  const when = nightWhen(event?.startsAt ?? h?.startsAt, event?.endsAt ?? h?.endsAt);
  const marks: Mark[] = [
    ...(guestName ? [{ name: guestName, color: event?.guestColor ?? brand?.guest?.accent }] : []),
    { name: hostName || title, color: event?.barColor ?? brand?.host.accent },
  ];

  /** Each party's mark colour: the guest's and host's as the header draws them, brands after. */
  const colorOf = (partyId: string | null): string | null => {
    // As Marks colours them: its own colour, else the next of partyHues.
    const markColor = (i: number) => (isHexColor(marks[i].color) ? marks[i].color! : partyHues[(i + 1) % partyHues.length]);
    if (partyId === null) return markColor(marks.length - 1);
    const i = (data?.parties ?? []).findIndex((p) => p.id === partyId);
    return data?.parties[i]?.kind === 'guest' && guestName ? markColor(0) : partyHues[(i + 3) % partyHues.length];
  };

  const sheet: RunSheet | null = useMemo(
    () => (data ? buildRunSheet({ ...data, hostName: data.menu.hostName, hostLogoUrl: data.menu.hostLogoUrl, breakDownPreps: false, marginPct: h?.marginPct }) : null),
    [data, h?.marginPct],
  );

  const role = h?.roleId ? (matrix ?? []).find((r) => r.role_id === h.roleId) ?? null : null;
  const guests: GuestBartender[] = h?.roleId
    ? [
        ...(members ?? []).filter((m) => m.venue_role_id === h.roleId).map((m) => ({ key: m.user_id, name: m.display_name || 'Guest bartender', line: `Access ends ${accessEnds(m.role_ends_at ?? role?.ends_at) ?? 'with the takeover'}` })),
        // An invite they've already taken is them, once.
        ...(invites ?? []).filter((i) => i.venue_role_id === h.roleId && !(members ?? []).some((mm) => mm.email && mm.email.toLowerCase() === i.email.toLowerCase())).map((i) => ({ key: i.id, name: i.name || i.email, line: `Invited · access ends ${accessEnds(role?.ends_at) ?? 'with the takeover'}` })),
      ]
    : [];

  const theirs = (data?.drinks ?? []).filter((d) => !guest || d.partyId === guest.id || d.partyId === null);
  const offIds = new Set((off ?? []).filter((o) => o.menuId === house?.id && Date.parse(o.until) > Date.parse(event?.startsAt ?? h?.startsAt ?? new Date(now).toISOString())).map((o) => o.itemId));
  const houseDrinks = houseTonight((houseDetail?.sections ?? []).flatMap((s) => s.drinks), offIds, event?.houseMenuOn ?? null);
  const open = stillOpen(theirs, guests[0] ? firstName(guests[0].name) : guestName);
  const makers = useListMakers(theirs.map((d) => d.itemId)).data ?? {};

  return {
    loading: head.isLoading || run.isLoading,
    head: h,
    barId,
    hostName,
    guest,
    guestName,
    title,
    when,
    marks,
    colorOf,
    sheet,
    data,
    theirs,
    /** Who made each of their drinks, by item id. */
    makers,
    house: house ? { name: house.name, ...houseDrinks } : null,
    role,
    matrix: matrix ?? [],
    guests,
    open,
    // Guests join a takeover list's own role; any other list never gets one from here.
    canStaff: staff && !!h?.isTakeoverList,
    canPlan: can('menus'),
  };
}

export type TakeoverModel = ReturnType<typeof useTakeoverModel>;
