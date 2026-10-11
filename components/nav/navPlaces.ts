import type { IconName } from '@/components/ds';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { useEffectiveRole } from '@/hooks/useViewAs';
import type { NavMatch } from '@/lib/shellNav';
import { canSeeTeam } from '@/lib/team';

import { HOME_TABS, VENUE_TABS } from './WebTabBar';

/** A place the shell links to: the sidebar, the tablet rail and the phone's venue menu share these. */
export interface Place extends NavMatch {
  label: string;
  icon: IconName;
  /** Tabs switch with navigate; the rest open over them with push. */
  tab?: boolean;
}

const tabPath = (name: string) => (name === 'index' ? '/' : `/${name}`);

/**
 * Where the shell can take you, for the mode you're in: the tabs (the same
 * ones as the phone bar), the venue's working pages (Menus, Back bar), and
 * its Venue section (My team, Brand, Venue settings).
 *
 * ponytail: "Roles and access" (drawn in the Venue section and the venue
 * menu) has no page yet; the venue tools work adds one. Add it to `venue`
 * between Brand and Venue settings when its route lands. "This week" comes
 * with PR #491's /week page.
 */
export function useNavPlaces() {
  const { mode } = useMode();
  const { active } = useActiveVenue();
  const role = useEffectiveRole(active?.id ?? null);
  const home = mode === 'home';
  const venue = home ? null : active;

  const tabs: Place[] = (home ? HOME_TABS : VENUE_TABS).map((t) => ({ key: t.name, label: t.label, icon: t.icon, path: tabPath(t.name), tab: true }));
  const work: Place[] = venue
    ? [
        { key: 'menus', label: 'Menus', icon: 'list.bullet', path: '/menus/all', prefix: '/menus' },
        { key: 'back-bar', label: 'Back bar', icon: 'map.fill', path: '/back-bar' },
      ]
    : [];
  const settings = venue ? `/settings/bar/${venue.id}` : null;
  const venuePlaces: Place[] =
    venue && settings
      ? [
          ...(canSeeTeam(role) ? [{ key: 'team', label: 'My team', icon: 'person.2.fill', path: '/team' } as Place] : []),
          { key: 'brand', label: 'Brand', icon: 'paintpalette.fill', path: `${settings}/brand` },
          { key: 'venue-settings', label: 'Venue settings', icon: 'building.2.fill', path: settings, prefix: settings },
        ]
      : [];
  // History sits under Discover in the sidebar (decided on the canvas), in both modes.
  const history: Place = { key: 'history', label: 'History', icon: 'clock.arrow.circlepath', path: '/history' };
  return { home, venue, tabs, work, venuePlaces, history };
}
