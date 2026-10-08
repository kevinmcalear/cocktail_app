import { useMemo } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useMode } from '@/hooks/useMode';
import { PERSONAL_CONTEXT, venueContextIds } from '@/lib/barContextFilter';
import type { SearchScope } from '@/lib/searchScope';

/**
 * What the one search's first scope is: the active venue's library in venue
 * mode, your own drinks in home mode. Venue mode opens on it; home mode and
 * guests open on Everywhere.
 */
export function useSearchMine() {
  const signedIn = !!useAuth().user;
  const { mode } = useMode();
  const { active, isLoading } = useActiveVenue();
  const venue = mode === 'venue' ? active : null;
  const contextIds = useMemo(
    () => (mode === 'venue' ? venueContextIds(active?.id ?? null, isLoading) : [PERSONAL_CONTEXT]),
    [mode, active?.id, isLoading]
  );
  const { data: capabilities } = useCapabilities(venue?.id ?? null);
  return {
    label: venue?.name ?? 'Your drinks',
    contextIds,
    venueId: venue?.id ?? null,
    defaultScope: (venue ? 'mine' : 'everywhere') as SearchScope,
    /** May add a drink here when nothing matches: Drink Creator and up at a venue, anyone signed in at home. */
    canAdd: venue ? !!capabilities?.includes('edit_drinks') : signedIn,
  };
}

export type SearchMine = ReturnType<typeof useSearchMine>;
