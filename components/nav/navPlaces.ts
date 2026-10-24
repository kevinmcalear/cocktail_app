import type { IconName } from '@/components/ds';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useFirstRound } from '@/hooks/useFirstRound';
import { useMode } from '@/hooks/useMode';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { useEffectiveRole } from '@/hooks/useViewAs';
import type { NavMatch } from '@/lib/shellNav';
import { canSeeTeam } from '@/lib/team';
import { tabPath } from '@/lib/venueFeatures';

import { useModeTabs } from './WebTabBar';

// Admin, the level that can switch a venue's features (lib/roles.ts).
const ADMIN = 40;

/** A place the shell links to: the sidebar, the tablet rail and the phone's venue menu share these. */
export interface Place extends NavMatch {
  label: string;
  icon: IconName;
  /** Tabs switch with navigate; the rest open over them with push. */
  tab?: boolean;
}

/** Menus, for the phone's venue menu: a tab everywhere else. */
export const MENUS_PLACE: Place = { key: 'menus', label: 'Menus', icon: 'text.alignleft', path: '/menus/all', prefix: '/menus' };

/**
 * Where the shell can take you, for the mode you're in: the tabs (the
 * phone bar's, with none left out), the venue's working pages (Back bar),
 * and its Venue section (My team, Features, Brand, Roles and access, Venue settings).
 * History and This week are null where the venue hasn't switched them on.
 */
export function useNavPlaces() {
  const { mode } = useMode();
  const { active } = useActiveVenue();
  const { has } = useVenueFeatures();
  const role = useEffectiveRole(active?.id ?? null);
  // The first round keeps the venue's places to Venue settings until it's over (lib/firstRound.ts).
  const round = useFirstRound().active;
  const home = mode === 'home';
  const venue = home ? null : active;

  // Menus covers its own pages (/menus/<id>/edit) too.
  const tabs: Place[] = useModeTabs().map((t) => ({ key: t.name, label: t.label, icon: t.icon, path: tabPath(t.name), prefix: t.name === 'menus' ? '/menus' : undefined, tab: true }));
  const work: Place[] = venue && !round && has('backBar') ? [{ key: 'back-bar', label: 'Back bar', icon: 'map.fill', path: '/back-bar' }] : [];
  const settings = venue ? `/settings/bar/${venue.id}` : null;
  const venuePlaces: Place[] =
    venue && settings
      ? [
          ...(canSeeTeam(role) && !round ? [{ key: 'team', label: 'My team', icon: 'person.2.fill', path: '/team' } as Place] : []),
          // Features is the Admins' (bars_update lets only them switch), first round or not: the round's last card opens it.
          ...(role >= ADMIN ? [{ key: 'features', label: 'Features', icon: 'switch.2', path: `${settings}/features` } as Place] : []),
          ...(round
            ? []
            : [
                { key: 'brand', label: 'Brand', icon: 'paintpalette.fill', path: `${settings}/brand` } as Place,
                { key: 'roles', label: 'Roles and access', icon: 'lock.shield.fill', path: `${settings}/roles` } as Place,
              ]),
          { key: 'venue-settings', label: 'Venue settings', icon: 'slider.horizontal.3', path: settings, prefix: settings },
        ]
      : [];
  // History sits under Discover in the sidebar (decided on the canvas), in both modes.
  const history: Place | null = !round && has('history') ? { key: 'history', label: 'History', icon: 'clock.arrow.circlepath', path: '/history' } : null;
  // This week: the venue's week, or at home the bars you love and your dated menus. The sidebar lists it itself (WeekNav).
  const week: Place | null = !round && has('tonight') ? { key: 'week', label: 'This week', icon: 'calendar', path: '/week' } : null;
  return { home, venue, tabs, work, venuePlaces, history, week };
}
