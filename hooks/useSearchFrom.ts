import { useRouter, useSegments, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

import type { SearchArea } from '@/components/search/SearchPanel';
import { SEARCH_TAB } from '@/hooks/useBottomBar';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { tabOfGroup } from '@/lib/tabs';
import { useSearchPalette, type SearchStart } from '@/store/useSearchPalette';

interface SearchFrom {
  /** The last tab opened before search ('tonight', 'drinks', 'discover', 'you'). */
  from: string | null;
  /** Discover's area while Discover is mounted, so search can search it. */
  area: SearchArea | null;
  /** Discover shows a search's results on its map. */
  showOnMap: ((query: string) => void) | null;
  /** A search a door opened search on (Discover's pill, My Bar's "Search every drink for …"); search takes it once. */
  start: SearchStart | null;
}

/** Where search was opened from (search-starts-here, 22 Oct 2026). */
export const useSearchFrom = create<SearchFrom>(() => ({ from: null, area: null, showOnMap: null, start: null }));

/** iPhone's search tab: a group with no path of its own, so it's named by its group (app/(tabs)/(search)). */
export const SEARCH_TAB_HREF = '/(tabs)/(search)' as Href;

/**
 * Opens the one search on a query and a place: the ⌘K palette on wide
 * screens, the bottom search on phones (decided 24 Oct 2026, q01 and q02):
 * iPhone's search tab, or the /search page Android and phone web push over
 * the tabs. With nothing given, it opens where the door's tab starts.
 */
export function useOpenSearch() {
  const router = useRouter();
  const wide = useIsWideWeb();
  return (start: SearchStart = { query: '', scope: null }) => {
    if (wide) return useSearchPalette.getState().search(start);
    useSearchFrom.setState({ start });
    router.navigate(SEARCH_TAB ? SEARCH_TAB_HREF : '/search');
  };
}

/** Remembers the tab that's showing, so search can start there. Called by the tab layouts. */
export function useTrackTab() {
  const segments = useSegments() as string[];
  const tab = segments[0] === '(tabs)' ? tabOfGroup(segments[1]) : null;
  useEffect(() => {
    if (tab) useSearchFrom.setState({ from: tab });
  }, [tab]);
}

/**
 * Discover lends search its area, kinds and map while it's mounted.
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
