import { useMemo, useState } from 'react';

import { useSignedIn } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useVenueMenus } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { PERSONAL_CONTEXT, venueContextIds } from '@/lib/barContextFilter';
import { menuDrinks } from '@/lib/drinksFilters';
import type { SearchScope } from '@/lib/searchScope';

/**
 * What the one search's first scope is: the active venue's library in venue
 * mode, your own drinks in home mode. Venue mode opens on it; home mode and
 * guests open on Everywhere.
 */
export function useSearchMine() {
  const signedIn = useSignedIn();
  const { mode } = useMode();
  const { active, isLoading } = useActiveVenue();
  const venue = mode === 'venue' ? active : null;
  const contextIds = useMemo(
    () => (mode === 'venue' ? venueContextIds(active?.id ?? null, isLoading) : [PERSONAL_CONTEXT]),
    [mode, active?.id, isLoading]
  );
  const { data: capabilities } = useCapabilities(venue?.id ?? null);
  // R&D trials stay out of the venue's search, as they stay out of Library's All.
  const { data: menus } = useVenueMenus(venue?.id ?? null);
  const [now] = useState(() => Date.now());
  const hiddenIds = useMemo(() => (venue && menus ? menuDrinks(menus, now, null).rnd : []), [venue, menus, now]);
  return {
    label: venue?.name ?? 'Your drinks',
    contextIds,
    venueId: venue?.id ?? null,
    defaultScope: (venue ? 'mine' : 'everywhere') as SearchScope,
    /** May add a drink here when nothing matches: Drink Creator and up at a venue, anyone signed in at home. */
    canAdd: venue ? !!capabilities?.includes('edit_drinks') : signedIn,
    /** May log a batch of house-made: who preps or keeps the specs at a venue (Tonight's Before doors). */
    canPrep: !!venue && !!capabilities?.some((c) => c === 'prep' || c === 'specs'),
    /** Drinks the venue's search leaves out: R&D trials on no menu. Item ids. */
    hiddenIds,
  };
}

export type SearchMine = ReturnType<typeof useSearchMine>;
