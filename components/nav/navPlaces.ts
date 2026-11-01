import type { IconName } from '@/components/ds';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useFirstRound } from '@/hooks/useFirstRound';
import { useMode } from '@/hooks/useMode';
import { useEffectiveRole } from '@/hooks/useViewAs';
import type { NavMatch } from '@/lib/shellNav';
import { canSeeTeam } from '@/lib/team';
import { BACK_BAR_SHOWN } from '@/lib/backBar';

import { WEB_TABS } from './WebTabBar';

/** A place the shell links to: the sidebar, the tablet rail and the phone's venue menu share these. */
export interface Place extends NavMatch {
  label: string;
  icon: IconName;
  /** Tabs switch with navigate; the rest open over them with push. */
  tab?: boolean;
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
  return { home, venue, tabs, menus, work, venuePlaces, history, week };
}
