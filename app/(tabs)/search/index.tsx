import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

import { BackbarTheme } from '@/components/ds';
import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { BottomSearch, SystemBottomSearch, type SearchTabState } from '@/components/search/BottomSearch';
import { SYSTEM_BOTTOM_SEARCH, useBottomSearch } from '@/hooks/useBottomBar';
import { useSearchMine } from '@/hooks/useSearchMine';
import { useSearchFrom } from '@/hooks/useSearchFrom';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import type { City } from '@/lib/discover';
import { startScope, type SearchScope, type SearchShow, type ShowCounts } from '@/lib/searchScope';
import { useSearchPalette } from '@/store/useSearchPalette';

/**
 * The search circle beside the tabs: the one search, opened where you came
 * from (search-starts-here, 22 Oct 2026): Discover's area from Discover, else
 * the venue in venue mode and Everywhere in home mode. On phones the field sits at the
 * bottom, over the keyboard (components/search/BottomSearch.tsx); it's
 * focused, keyboard up, every time the tab opens, and leaving the tab puts
 * the keyboard away. Wide screens open the same search as a palette (⌘K).
 */
export default function SearchScreen() {
  return (
    <BackbarTheme>
      <MountOnFocus>
        <SearchTab />
      </MountOnFocus>
    </BackbarTheme>
  );
}

function SearchTab() {
  const bottom = useBottomSearch();
  if (!bottom) return <ToPalette />;
  return <BottomTab />;
}

function BottomTab() {
  const state = useSearchTabState();
  return SYSTEM_BOTTOM_SEARCH ? <SystemBottomSearch {...state} /> : <BottomSearch {...state} />;
}

/**
 * Wide screens search in the ⌘K palette, not on a page (q01, decided 24 Oct 2026):
 * a /search link opens the palette, with what it carries, over the first tab.
 */
function ToPalette() {
  const router = useRouter();
  const { q, scope } = useLocalSearchParams<{ q?: string; scope?: string }>();
  // Straight to the page the first tab would redirect to (app/(tabs)/index.tsx), so nothing moves under the palette.
  const { ready, home, has } = useVenueFeatures();
  const first = home ? '/discover' : has('tonight') ? '/' : '/library';
  useEffect(() => {
    if (!ready && !home) return;
    const start = { query: q ?? '', scope: scope === 'everywhere' ? ('everywhere' as const) : null };
    router.replace(first);
    // After the move: the palette closes when the page under it changes.
    const t = setTimeout(() => useSearchPalette.getState().search(start), 0);
    return () => clearTimeout(t);
  }, [ready, home, first, q, scope, router]);
  return null;
}

function useSearchTabState(): SearchTabState {
  const mine = useSearchMine();
  const router = useRouter();
  // ?q= carries a search in from a link, and ?scope=everywhere where it starts.
  const { q, scope: carriedScope } = useLocalSearchParams<{ q?: string; scope?: string }>();
  const everywhere = carriedScope === 'everywhere' ? 'everywhere' : null;
  // A door's search (Discover's pill, My Bar's "Search every drink for “rye”", hooks/useSearchFrom.ts), taken once.
  const { from, area, showOnMap, start: opened } = useSearchFrom();
  const [query, setQuery] = useState(opened?.query ?? q ?? '');
  const [carried, setCarried] = useState(q);
  const [picked, pickScope] = useState<SearchScope | null>(opened ? opened.scope : everywhere);
  // The native field holds its own text: what's carried in is written into it.
  const [written, setWritten] = useState<{ query: string } | undefined>(() => (opened?.query || q ? { query: opened?.query ?? q ?? '' } : undefined));
  // The type chips: All, Drinks 4, Ingredients 2. A new place starts back on All.
  const [show, setShow] = useState<SearchShow>('all');
  // Opened from another tab: start over on that tab's place. A drink opened from
  // the results and closed again keeps the place you picked.
  const [startedFrom, setStartedFrom] = useState(from);
  if (from !== startedFrom) {
    setStartedFrom(from);
    pickScope(null);
    setShow('all');
  }
  // A search carried in by a link starts where it says.
  if (q !== carried) {
    setCarried(q);
    if (q) {
      setQuery(q);
      setWritten({ query: q });
    }
    if (everywhere) pickScope(everywhere);
  }
  const [took, setTook] = useState(opened);
  if (opened && opened !== took) {
    setTook(opened);
    setQuery(opened.query);
    setWritten({ query: opened.query });
    pickScope(opened.scope);
    setShow('all');
  }
  useEffect(() => {
    if (opened) useSearchFrom.setState({ start: null });
  }, [opened]);
  const start = startScope(from, mine.defaultScope, !!area?.label);
  const scope = picked === 'area' && !area?.label ? start : (picked ?? start);
  const [counts, setCounts] = useState<ShowCounts>({});
  const setScope = (next: SearchScope) => {
    pickScope(next);
    setShow('all');
  };
  // Native tabs stay mounted, so focus follows the tab rather than the first mount.
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) Keyboard.dismiss();
  }, [focused]);
  // Discover's results go back to its map; its style and city picks land there too.
  const toDiscover = () => router.navigate('/discover');
  const lent = area && { ...area, onKind: (k: string) => (area.onKind(k), toDiscover()), onPlace: (c: City) => (area.onPlace(c), toDiscover()) };
  const onShowOnMap = showOnMap ? () => (showOnMap(query), toDiscover()) : undefined;
  return { query, setQuery, scope, setScope, mine, area: lent, onShowOnMap, focused, carried: written, show, setShow, counts, setCounts };
}
