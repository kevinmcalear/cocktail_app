import { useEffect, useMemo, useState } from 'react';

import type { IconName } from '@/components/ds';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useFirstRound } from '@/hooks/useFirstRound';
import { useVenueMenus } from '@/hooks/useMenus';
import { usePrepData } from '@/hooks/usePrepList';
import { useShelf } from '@/hooks/useHomeBar';
import { useMode } from '@/hooks/useMode';
import { useEffectiveRole } from '@/hooks/useViewAs';
import type { NavMatch } from '@/lib/shellNav';
import { groupMenus } from '@/lib/menus';
import { buildPrepList, DEFAULT_SERVES, tonightAt6 } from '@/lib/prep';
import { canSeeTeam } from '@/lib/team';
import { BACK_BAR_SHOWN } from '@/lib/backBar';

import { WEB_TABS } from './WebTabBar';

/** A place the shell links to: the sidebar, the tablet rail and the phone's venue menu share these. */
export interface Place extends NavMatch {
  label: string;
  icon: IconName;
  /** Tabs switch with navigate; the rest open over them with push. */
  tab?: boolean;
  /** The rail's 64 px label, where the full one would cut off. */
  short?: string;
}

/** Menus: a page, opened from Tonight, Drinks, the venue menu and the sidebar. */
export const MENUS_PLACE: Place = { key: 'menus', label: 'Menus', icon: 'place.menus', path: '/menus/all', prefix: '/menus' };

/**
 * Where the shell can take you, for the mode you're in: the four tabs, the
 * venue's working pages (Menus, Glassware),
 * and its Venue section (My team, Rota, Brand, Roles and access, Venue settings).
 * History and This week are null during the first round.
 */
export function useNavPlaces() {
  const { mode } = useMode();
  const { active } = useActiveVenue();
  const role = useEffectiveRole(active?.id ?? null);
  // The first round keeps the venue's places to Venue settings until it's over (lib/firstRound.ts).
  const { active: round, hidden } = useFirstRound();
  const home = mode === 'home';
  const venue = home ? null : active;

  // The four tabs, the same in both modes.
  const tabs: Place[] = WEB_TABS.map((t) => ({ key: t.name, label: t.label, icon: t.icon, path: t.path, tab: true }));
  const settings = venue ? `/settings/bar/${venue.id}` : null;
  const work: Place[] =
    venue && settings && !round
      ? [
          // Prep and Study fold into Tonight later; till then they open from here and Tonight.
          { key: 'prep', label: 'Prep', icon: 'place.prep', path: '/prep' },
          { key: 'study', label: 'Study', icon: 'place.study', path: '/test' },
          ...(BACK_BAR_SHOWN ? [{ key: 'back-bar', label: 'Back bar', icon: 'place.backbar', path: '/back-bar' } as Place] : []),
          // Glassware is a working page, not a setting (Eddie, 29 Oct 2026): Kit's page, with its glasses' own pages under it.
          { key: 'glassware', label: 'Glassware', icon: 'wineglass', path: `${settings}/glassware`, prefix: `${settings}/kit/glassware` },
        ]
      : [];
  const venuePlaces: Place[] =
    venue && settings
      ? [
          ...(canSeeTeam(role) && !round ? [{ key: 'team', label: 'My team', icon: 'place.team', path: '/team' } as Place] : []),
          // The rota: everyone at the bar reads it.
          ...(round ? [] : [{ key: 'rota', label: 'Rota', icon: 'calendar', path: '/team/rota' } as Place]),
          ...(round
            ? []
            : [
                { key: 'brand', label: 'Brand', icon: 'place.brand', path: `${settings}/brand` } as Place,
                { key: 'roles', label: 'Roles and access', icon: 'place.roles', path: `${settings}/roles` } as Place,
              ]),
          { key: 'venue-settings', label: 'Venue settings', icon: 'place.settings', path: settings, prefix: settings },
        ]
      : [];
  // History sits under Discover in the sidebar (decided on the canvas), in both modes.
  const history: Place | null = !round ? { key: 'history', label: 'History', icon: 'place.history', path: '/history' } : null;
  // This week: the venue's week, or at home the bars you love and your dated menus. The sidebar lists it itself (WeekNav).
  const week: Place | null = !round ? { key: 'week', label: 'This week', icon: 'place.week', path: '/week' } : null;
  // Menus waits for its step in the first round (lib/firstRound.ts).
  const menus: Place | null = venue && !hidden.includes('menus') ? MENUS_PLACE : null;

  // The sidebar and rail's groups, as board Prod-desk draws them: the bar's Menus, House-made, Team and Bar settings,
  // then Home's Shelf and Menus. Everything else (Study, Glassware, Rota, Brand, Roles, This week, History) opens from
  // Bar settings, Tonight and Search (components/bar/VenueSettingsLinks.tsx).
  const bar: Place[] =
    venue && settings
      ? [
          ...(menus ? [menus] : []),
          ...(round ? [] : [{ key: 'prep', label: 'House-made', short: 'House', icon: 'flask', path: '/prep' } as Place]),
          // The Team row stays lit on the rota (/team/rota).
          ...(canSeeTeam(role) && !round ? [{ key: 'team', label: 'Team', icon: 'place.team', path: '/team', prefix: '/team' } as Place] : []),
          { key: 'venue-settings', label: 'Bar settings', short: 'Settings', icon: 'place.settings', path: settings, prefix: settings },
        ]
      : [];
  // Home's Menus is the same page as the bar's (it shows your own menus in home mode), so it switches mode first.
  const homePlaces: Place[] = [
    { key: 'shelf', label: 'Shelf', icon: 'place.mybar', path: '/shelf' },
    ...(round ? [] : [{ key: 'home-menus', label: 'Menus', icon: 'place.menus', path: '/menus/all', prefix: '/menus' } as Place]),
  ];
  return { home, venue, tabs, menus, work, venuePlaces, history, week, bar, homePlaces };
}

/** What the bar's rows say at their right (board Prod-desk): the menu on now, how much house-made is low, the shelf's count. */
export type SideNotes = Record<string, { text: string; warn?: boolean; label?: string } | undefined>;

/**
 * The notes beside the sidebar's rows: "on now" for the menu running, "1 low" for house-made short for tonight (the
 * Prep list's own rule, shared queries with Tonight and Prep), and how many bottles are on the shelf. Only the
 * sidebar and rail ask, so the phone's venue menu never pays for them.
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
  const prepData = usePrepData(canPrep ? venueId : null, on.map((m) => m.id)).data;
  const low = useMemo(
    () => (prepData ? buildPrepList({ ...prepData, servesPerDrink: DEFAULT_SERVES, startsAt: tonightAt6(), now: new Date() }).make.length : 0),
    [prepData]
  );
  const shelf = useShelf().data?.length;
  return {
    // One menu running is named, as the board draws it ("Autumn, on now"); several are counted.
    menus: on.length ? (on.length === 1 ? { text: 'on now', label: on[0].name } : { text: `${on.length} on now` }) : undefined,
    prep: low ? { text: `${low} low`, warn: true } : undefined,
    shelf: shelf ? { text: String(shelf) } : undefined,
  };
}
