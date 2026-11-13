import { useEffect, useMemo, useState } from 'react';

import type { IconName } from '@/components/ds';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useFirstRound } from '@/hooks/useFirstRound';
import { useVenueMenus } from '@/hooks/useMenus';
import { usePrepData } from '@/hooks/usePrepList';
import { useShelf } from '@/hooks/useHomeBar';
import { useMode } from '@/hooks/useMode';
import { useBackBarShown } from '@/hooks/useBackBarShown';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { useEffectiveRole } from '@/hooks/useViewAs';
import type { NavMatch } from '@/lib/shellNav';
import { groupMenus } from '@/lib/menus';
import { buildPrepList, DEFAULT_SERVES, tonightAt6 } from '@/lib/prep';
import { canSeeTeam } from '@/lib/team';

import { useWebTabs } from './WebTabBar';

/** A row of the desktop sidebar, the tablet rail or the phone's place sheet. */
export interface Place extends NavMatch {
  label: string;
  icon: IconName;
  /** Tabs switch with navigate; the rest open over them with push. */
  tab?: boolean;
  /** The rail's 64 px label, where the full one would cut off. */
  short?: string;
}

/** Settings: the last row of the phone's place sheet, under You (the sidebar has its You footer instead). */
export const SETTINGS_PLACE: Place = { key: 'settings', label: 'Settings', icon: 'place.settings', path: '/settings' };

/**
 * Every place the shell links to, for the one place you're in. `places` is that place's group, as board Prod-desk
 * (C7) draws the sidebar: at a bar, its Menus, House-made, Team and Bar settings; at home, Shelf and Menus. Never
 * both: you switch place from the group's chip (the places menu, board C8). `more` is the rest of a bar's pages
 * (Study, Glassware, This week, Rota, Theme, Roles and access): the phone's place sheet lists them under
 * `places` (board C8, Kevin 3 Nov 2026); on wide screens they open from Bar settings, Tonight and Search
 * (components/bar/VenueSettingsLinks.tsx). Each waits for the bar's section switch (lib/venueFeatures.ts) and your
 * capabilities. The first round holds everything but Menus and Bar settings back until it's over (lib/firstRound.ts).
 */
export function useSidePlaces() {
  const { mode } = useMode();
  const { active, isLoading } = useActiveVenue();
  const role = useEffectiveRole(active?.id ?? null);
  const { active: round, hidden } = useFirstRound();
  // House-made opens the prep list: the Prep switch's (lib/venueFeatures.ts).
  const { has } = useVenueFeatures();
  const backBar = useBackBarShown();
  const venue = mode === 'home' ? null : active;
  // Theme is for the people who can change it: Admins, the brand permission (Kevin, 31 Oct).
  const canTheme = (useCapabilities(venue?.id).data ?? []).includes('brand');
  // Home when you chose it, or when you're on no bar's team. While a bar is still loading, no group yet, so the chip never shows the wrong place.
  const atHome = mode === 'home' || (!venue && !isLoading);
  const settings = venue ? `/settings/bar/${venue.id}` : null;
  const takeovers = useTakeoverLists(venue?.id ?? null);

  // The four tabs, without Tonight at a venue that hasn't switched it on.
  const tabs: Place[] = useWebTabs().map((t) => ({ key: t.name, label: t.label, icon: t.icon, path: t.path, tab: true }));
  const bar: Place[] =
    venue && settings
      ? [
          // Menus waits for its step in the first round.
          ...(hidden.includes('menus') ? [] : [{ key: 'menus', label: 'Menus', icon: 'place.menus', path: '/menus/all', prefix: '/menus' } as Place]),
          // A takeover coming up or on now, as its own row under the bar (Kept-takeover-desk).
          ...(round ? [] : takeovers.map((t): Place => ({ key: `takeover-${t.id}`, label: t.name, icon: 'calendar', path: `/takeover/${t.id}` }))),
          ...(round || !has('prep') ? [] : [{ key: 'prep', label: 'House-made', short: 'House', icon: 'flask', path: '/prep' } as Place]),
          // The Team row stays lit on the rota (/team/rota).
          ...(canSeeTeam(role) && !round ? [{ key: 'team', label: 'Team', icon: 'place.team', path: '/team', prefix: '/team' } as Place] : []),
          { key: 'venue-settings', label: 'Bar settings', short: 'Settings', icon: 'place.settings', path: settings, prefix: settings },
        ]
      : [];
  // Home's Menus is the bar's page in home mode, where it shows your own menus.
  const home: Place[] = [
    // The shelf is Drinks' Shelf capsule at home (app/bar.tsx); there is no /shelf route.
    { key: 'shelf', label: 'Shelf', icon: 'place.mybar', path: '/drinks?tab=shelf', tab: true },
    ...(round ? [] : [{ key: 'home-menus', label: 'Menus', icon: 'place.menus', path: '/menus/all', prefix: '/menus' } as Place]),
  ];
  const more: Place[] =
    venue && settings && !round
      ? [
          ...(has('study') ? [{ key: 'study', label: 'Study', icon: 'place.study', path: '/test' } as Place] : []),
          // Back bar stays hidden everywhere while BACK_BAR_SHOWN is off (Kevin, 3 Nov 2026), whatever the bar's switch says.
          ...(backBar ? [{ key: 'back-bar', label: 'Back bar', icon: 'place.backbar', path: '/back-bar' } as Place] : []),
          // Glassware is a working page, not a setting (Eddie, 29 Oct 2026): Kit's page, with its glasses' own pages under it.
          { key: 'glassware', label: 'Glassware', icon: 'wineglass', path: `${settings}/glassware`, prefix: `${settings}/kit/glassware` },
          // This week lives with Tonight: its switch takes both (app/week/index.tsx).
          ...(has('tonight') ? [{ key: 'week', label: 'This week', icon: 'place.week', path: '/week' } as Place] : []),
          // The rota: everyone at the bar reads it.
          { key: 'rota', label: 'Rota', icon: 'calendar', path: '/team/rota' },
          ...(canTheme ? [{ key: 'theme', label: 'Theme', icon: 'place.theme', path: `${settings}/theme` } as Place] : []),
          { key: 'roles', label: 'Roles and access', icon: 'place.roles', path: `${settings}/roles` },
        ]
      : [];
  return { venue, atHome, tabs, places: venue ? bar : atHome ? home : [], more };
}

/** Not over: its end is ahead, or with no end, it starts less than a day ago (or hasn't a date yet). */
function takeoverAhead(m: { endsAt: string | null; plannedEndsAt?: string | null; startsAt: string | null; plannedStartsAt: string | null }, now: number): boolean {
  const end = m.endsAt ?? m.plannedEndsAt ?? null;
  if (end) return Date.parse(end) > now;
  const start = m.plannedStartsAt ?? m.startsAt;
  return !start || Date.parse(start) > now - 86_400_000;
}

/** "Thu": a takeover's day in the sidebar. */
function weekday(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { weekday: 'short' }) : '';
}

/** The bar's takeover lists not over yet, soonest first: the sidebar's rows for them. */
function useTakeoverLists(venueId: string | null) {
  const menus = useVenueMenus(venueId).data;
  const [now] = useState(() => Date.now());
  return useMemo(
    () =>
      (menus ?? [])
        .filter((m) => m.barId === venueId && m.listType === 'takeover' && !m.hiddenAt && takeoverAhead(m, now))
        .sort((a, b) => Date.parse(a.plannedStartsAt ?? a.startsAt ?? a.createdAt) - Date.parse(b.plannedStartsAt ?? b.startsAt ?? b.createdAt)),
    [menus, venueId, now],
  );
}

/** What the bar's rows say at their right (board Prod-desk): the menu on now, how much house-made is low, the shelf's count. */
export type SideNotes = Record<string, { text: string; warn?: boolean; label?: string } | undefined>;

/**
 * The notes beside the sidebar's rows: "on now" for the menu running, "1 low" for house-made short for tonight (the
 * Prep list's own rule, shared queries with Tonight and Prep), and how many bottles are on the shelf. The sidebar
 * and rail ask, and the phone's place sheet once it's opened, so a phone's header never pays for them.
 */
export function useSideNotes(venueId: string | null): SideNotes {
  const menus = useVenueMenus(venueId).data;
  // The sidebar stays mounted all night: the clock moves on so a menu going on or ending shows.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);
  const on = useMemo(() => (venueId ? groupMenus((menus ?? []).filter((m) => m.barId === venueId), now).on : []), [menus, venueId, now]);
  const caps = useCapabilities(venueId).data;
  const canPrep = !!venueId && Array.isArray(caps) && (caps.includes('prep') || caps.includes('specs'));
  // The count only: five minutes fresh, no refetch on focus, and the same query Tonight and Prep read, so a cold page adds nothing it hasn't asked for.
  const low =
    usePrepData(canPrep ? venueId : null, on.map((m) => m.id), {
      staleTime: 5 * 60_000,
      select: (d) => buildPrepList({ ...d, servesPerDrink: DEFAULT_SERVES, startsAt: tonightAt6(), now: new Date(now) }).make.length,
    }).data ?? 0;
  const shelf = useShelf().data?.length;
  const takeovers = useTakeoverLists(venueId);
  return {
    // A takeover's day: "Thu".
    ...Object.fromEntries(takeovers.map((t) => [`takeover-${t.id}`, { text: weekday(t.plannedStartsAt ?? t.startsAt) }])),
    // One menu running is named, as the board draws it ("Autumn, on now"); several are counted.
    menus: on.length ? (on.length === 1 ? { text: 'on now', label: on[0].name } : { text: `${on.length} on now` }) : undefined,
    prep: low ? { text: `${low} low`, warn: true } : undefined,
    shelf: shelf ? { text: String(shelf) } : undefined,
  };
}
