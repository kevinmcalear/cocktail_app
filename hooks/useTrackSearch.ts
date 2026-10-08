import { useEffect } from 'react';

import { useDebounced } from '@/hooks/useDiscover';
import { track, type AnalyticsEvents } from '@/lib/analytics';

const SETTLE_MS = 600;

/**
 * Counts a search each time a search field goes from empty to holding
 * something, once typing settles. Sends where it happened, never the words.
 */
export function useTrackSearch(text: string, surface: AnalyticsEvents['search_used']['surface']) {
  const searching = useDebounced(text.trim().length > 0, SETTLE_MS);
  useEffect(() => {
    if (searching) track('search_used', { surface });
  }, [searching, surface]);
}
