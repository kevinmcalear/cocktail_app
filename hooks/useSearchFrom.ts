import { useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

import type { SearchArea } from '@/components/search/SearchPanel';

interface SearchFrom {
  /** The last tab opened before the search tab ('library', 'discover'; 'index' is Tonight). */
  from: string | null;
  /** Discover's area while Discover is mounted, so the search circle can search it. */
  area: SearchArea | null;
  /** Discover shows a search's results on its map. */
  showOnMap: ((query: string) => void) | null;
}

/** Where the search circle was opened from (search-starts-here, 22 Oct 2026). */
export const useSearchFrom = create<SearchFrom>(() => ({ from: null, area: null, showOnMap: null }));

/** Remembers the tab that's showing, so the search tab can start there. Called by the tab layouts. */
export function useTrackTab() {
  const segments = useSegments() as string[];
  const tab = segments[0] === '(tabs)' ? (segments[1] ?? 'index') : null;
  useEffect(() => {
    if (tab && tab !== 'search') useSearchFrom.setState({ from: tab });
  }, [tab]);
}

/**
 * Discover lends the search tab its area, kinds and map while it's mounted.
 * The calls go through a ref, so the latest ones run without re-publishing on every render.
 */
export function usePublishSearchArea(area: SearchArea, showOnMap: (query: string) => void) {
  const latest = useRef({ area, showOnMap });
  useEffect(() => {
    latest.current = { area, showOnMap };
  });
  const { label, area: where, kinds } = area;
  useEffect(() => {
    useSearchFrom.setState({
      area: { label, area: where, kinds, onKind: (k) => latest.current.area.onKind(k), onPlace: (c) => latest.current.area.onPlace(c) },
      showOnMap: (q) => latest.current.showOnMap(q),
    });
  }, [label, where, kinds]);
  useEffect(() => () => useSearchFrom.setState({ area: null, showOnMap: null }), []);
}
