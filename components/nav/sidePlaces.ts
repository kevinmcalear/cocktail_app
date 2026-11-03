import { useEffect, useMemo, useState } from 'react';

import type { IconName } from '@/components/ds';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useFirstRound } from '@/hooks/useFirstRound';
import { useVenueMenus } from '@/hooks/useMenus';
import { usePrepData } from '@/hooks/usePrepList';
import { useShelf } from '@/hooks/useHomeBar';
import { useMode } from '@/hooks/useMode';
import { useVenueFeature } from '@/hooks/useVenueFeatures';
import { useEffectiveRole } from '@/hooks/useViewAs';
import type { NavMatch } from '@/lib/shellNav';
import { groupMenus } from '@/lib/menus';
import { buildPrepList, DEFAULT_SERVES, tonightAt6 } from '@/lib/prep';
import { canSeeTeam } from '@/lib/team';

import { useWebTabs } from './WebTabBar';

/** A row of the desktop sidebar or the tablet rail. */
export interface Place extends NavMatch {
  label: string;
  icon: IconName;
  /** Tabs switch with navigate; the rest open over them with push. */
  tab?: boolean;
  /** The rail's 64 px label, where the full one would cut off. */
  short?: string;
}

/**
 * The sidebar and rail's rows, as board Prod-desk (C7) draws them: the four tabs, the bar's group (its Menus,
 * House-made, Team, Bar settings), then Home's Shelf and Menus. Everything else (Study, Glassware, Back bar, Rota,
 * Brand, Roles, This week, History) opens from Bar settings, Tonight and Search (components/bar/VenueSettingsLinks.tsx).
 * The first round holds House-made, Team and Home's Menus back until it's over (lib/firstRound.ts).
 */
export function useSidePlaces() {
  const { mode } = useMode();
  const { active } = useActiveVenue();
  const role = useEffectiveRole(active?.id ?? null);
  const { active: round, hidden } = useFirstRound();
  // House-made opens the prep list: the Prep switch's (lib/venueFeatures.ts).
  const prep = useVenueFeature('prep');
  const venue = mode === 'home' ? null : active;
  const settings = venue ? `/settings/bar/${venue.id}` : null;

  // The four tabs, without Tonight at a venue that hasn't switched it on.
  const tabs: Place[] = useWebTabs().map((t) => ({ key: t.name, label: t.label, icon: t.icon, path: t.path, tab: true }));
  const bar: Place[] =
    venue && settings
      ? [
          // Menus waits for its step in the first round.
          ...(hidden.includes('menus') ? [] : [{ key: 'menus', label: 'Menus', icon: 'place.menus', path: '/menus/all', prefix: '/menus' } as Place]),
          ...(round || !prep ? [] : [{ key: 'prep', label: 'House-made', short: 'House', icon: 'flask', path: '/prep' } as Place]),
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
  return { venue, tabs, bar, homePlaces };
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
  // The count only: five minutes fresh, no refetch on focus, and the same query Tonight and Prep read, so a cold page adds nothing it hasn't asked for.
  const low =
    usePrepData(canPrep ? venueId : null, on.map((m) => m.id), {
      staleTime: 5 * 60_000,
      select: (d) => buildPrepList({ ...d, servesPerDrink: DEFAULT_SERVES, startsAt: tonightAt6(), now: new Date(now) }).make.length,
    }).data ?? 0;
  const shelf = useShelf().data?.length;
  return {
    // One menu running is named, as the board draws it ("Autumn, on now"); several are counted.
    menus: on.length ? (on.length === 1 ? { text: 'on now', label: on[0].name } : { text: `${on.length} on now` }) : undefined,
    prep: low ? { text: `${low} low`, warn: true } : undefined,
    shelf: shelf ? { text: String(shelf) } : undefined,
  };
}
