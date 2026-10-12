import { useMemo } from 'react';

import { useSpecCatalog } from '@/hooks/useBulk';
import { useShelf } from '@/hooks/useHomeBar';
import { useMenuLibrary } from '@/hooks/useMenuMutations';
import type { MatchData } from '@/lib/bringInMatch';

/** What Bring in matches a reading against, for a venue or (null) your home bar. Null until it has loaded. */
export function useBringInMatchData(barId: string | null, enabled = true): MatchData | null {
  const { catalog, aliases, isLoading } = useSpecCatalog();
  const library = useMenuLibrary(barId, enabled);
  const shelf = useShelf();
  return useMemo(() => {
    if (!enabled || isLoading || library.isLoading || (!barId && shelf.isLoading)) return null;
    return { catalog, aliases, venueId: barId, library: library.data ?? [], shelf: shelf.data ?? [] };
  }, [enabled, isLoading, library.isLoading, library.data, shelf.isLoading, shelf.data, catalog, aliases, barId]);
}
