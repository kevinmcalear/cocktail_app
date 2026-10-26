import { useMemo } from 'react';

import { useSpecCatalog } from '@/hooks/useBulk';
import { useShelf } from '@/hooks/useHomeBar';
import { useMenuLibrary } from '@/hooks/useMenuMutations';
import { useServerMatch } from '@/hooks/useServerMatch';
import type { MatchData } from '@/lib/bringInMatch';
import type { Reading } from '@/lib/match';
import type { BringInJob } from '@/store/useBringIn';

/**
 * A bottle snap's readings, to match on the server: none yet while it reads,
 * null for anything else (a menu, recipes), which matches on the phone.
 */
export function bottleReadings(job: BringInJob | null | undefined): Reading[][] | null {
  if (job?.reading?.kind === 'bottles') return [job.reading.bottles];
  return job?.as === 'bottles' && !job.reading ? [] : null;
}

/**
 * What Bring in matches a reading against, for a venue or (null) your home
 * bar. Null until it has loaded. `bottles`: a snap's readings (groups of
 * them), matched on the server against a shortlist of the catalog, or on the
 * phone against the whole catalog when the server can't be asked.
 */
export function useBringInMatchData(barId: string | null, enabled = true, bottles: readonly (readonly Reading[])[] | null = null): MatchData | null {
  const server = useServerMatch(bottles ?? [], barId, enabled && !!bottles);
  const onPhone = !bottles || server.failed;
  const { catalog, aliases, isLoading } = useSpecCatalog(enabled && onPhone);
  const library = useMenuLibrary(barId, enabled);
  const shelf = useShelf();
  return useMemo(() => {
    if (!enabled || library.isLoading || (!barId && shelf.isLoading) || (onPhone ? isLoading : server.pending)) return null;
    const matched = onPhone ? { catalog, aliases } : server;
    return { catalog: matched.catalog, aliases: matched.aliases, venueId: barId, library: library.data ?? [], shelf: shelf.data ?? [] };
  }, [enabled, onPhone, isLoading, server, library.isLoading, library.data, shelf.isLoading, shelf.data, catalog, aliases, barId]);
}
