import { useIsFocused, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { BackbarTheme } from '@/components/ds';
import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { BottomSearch, SystemBottomSearch, type SearchTabState } from '@/components/search/BottomSearch';
import { TopSearch } from '@/components/search/TopSearch';
import { SEARCH_TAB, SYSTEM_BOTTOM_SEARCH, useBottomSearch } from '@/hooks/useBottomBar';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import { useSearchMine } from '@/hooks/useSearchMine';
import { SEARCH_TAB_HREF, useSearchFrom } from '@/hooks/useSearchFrom';
import type { City } from '@/lib/discover';
import { startScope, type SearchScope, type SearchShow, type ShowCounts } from '@/lib/searchScope';
import { useRecentSearches } from '@/store/useRecentSearches';
import { useSearchPalette, type SearchStart } from '@/store/useSearchPalette';

/**
 * The one search, opened where you came from (search-starts-here, 22 Oct
 * 2026): Discover's area from Discover, else the venue in venue mode and
 * Everywhere in home mode. It's focused, keyboard up, every time search
 * opens, and leaving puts the keyboard away.
 *
 * Its one address is /search, which every link and door opens
 * (hooks/useSearchFrom.ts useOpenSearch). The page lives in the folder the
 * four tabs share, so it's pushed on the tab it was opened from: a result
 * opened from it lands on that tab's stack, and Back returns to the search.
 * Where it shows:
 * - Android: that page, from the search bar on top of a tab's page, which
 *   opens into Material's search view with the nav bar put away (TopSearch.tsx).
 * - Phone-width web: that page, from the search circle beside its tabs, with
 *   the field at the bottom, over the keyboard (BottomSearch.tsx); the tab
 *   bar steps aside for it (WebTabBar.tsx).
 * - iPhone: the system's search tab, the circle beside the tabs, which turns
 *   the tab bar into the field ((tabs)/(search), `tab`). It can't be a page:
 *   iOS only does that for a tab. /search hands what it carries to that tab.
 * - Wide screens: the ⌘K palette (q01, decided 24 Oct 2026). /search hands
 *   what it carries to the palette over the first tab.
 */
export function SearchScreen({ tab = false }: { tab?: boolean }) {
  return (
    <BackbarTheme>
      <MountOnFocus>
        <Search tab={tab} />
      </MountOnFocus>
    </BackbarTheme>
  );
}

function Search({ tab }: { tab: boolean }) {
  const bottom = useBottomSearch();
  if (!bottom) return <HandOff to="palette" />;
  if (SEARCH_TAB && !tab) return <HandOff to="tab" />;
  return <BottomTab />;
}

function BottomTab() {
  const state = useSearchTabState();
  if (Platform.OS === 'android') return <TopSearch {...state} />;
  return SYSTEM_BOTTOM_SEARCH ? <SystemBottomSearch {...state} /> : <BottomSearch {...state} />;
}

/**
 * A /search link where search isn't a page: what it carries (?q=, ?scope=everywhere)
 * opens the ⌘K palette over the page under it, or iOS's search tab. The page
 * steps off its tab's stack first, so no empty search is left behind.
 */
function HandOff({ to }: { to: 'palette' | 'tab' }) {
  const router = useRouter();
  const { q, scope } = useLocalSearchParams<{ q?: string; scope?: string }>();
  useEffect(() => {
    const start: SearchStart = { query: q ?? '', scope: scope === 'everywhere' ? 'everywhere' : null };
    if (to === 'palette') useSearchPalette.getState().search(start);
    else useSearchFrom.setState({ start });
    // Opened cold, the tab's first page is under it (the stack's anchor).
    if (router.canGoBack()) router.back();
    else if (to === 'palette') router.replace('/');
    if (to === 'tab') router.navigate(SEARCH_TAB_HREF);
  }, [to, q, scope, router]);
  return null;
}

function useSearchTabState(): SearchTabState {
  const mine = useSearchMine();
  const router = useRouter();
  // ?q= carries a search in from a link, and ?scope=everywhere where it starts. The static page has neither,
  // so they're read once React has hydrated it: typed results in the first render threw the page away (#418).
  const params = useLocalSearchParams<{ q?: string; scope?: string }>();
  const hydrated = useIsHydrated();
  const q = hydrated ? params.q : undefined;
  const carriedScope = hydrated ? params.scope : undefined;
  const everywhere = carriedScope === 'everywhere' ? 'everywhere' : null;
  // A door's search (Discover's pill, My Bar's "Search every drink for “rye”", hooks/useSearchFrom.ts), taken once.
  const { from, area, start: opened } = useSearchFrom();
  const [query, setQuery] = useState(opened?.query ?? q ?? '');
  const [carried, setCarried] = useState(`${q}|${carriedScope}`);
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
  if (`${q}|${carriedScope}` !== carried) {
    setCarried(`${q}|${carriedScope}`);
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
  // iOS's search tab stays mounted, so focus follows the tab rather than the first mount.
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) Keyboard.dismiss();
  }, [focused]);
  // A search that opened something is one to come back to (search2, Recent).
  useEffect(() => {
    if (!focused) useRecentSearches.getState().add(query);
  }, [focused, query]);
  // Discover's results go back to its map; its style and city picks land there too.
  // Pushed on Discover's own stack, that's back down to it; from another tab, over to Discover.
  const onDiscover = (useSegments() as string[])[1] === '(3-discover)';
  const toDiscover = () => (onDiscover ? router.dismissTo('/discover') : router.navigate('/discover'));
  const lent = area && { ...area, onKind: (k: string) => (area.onKind(k), toDiscover()), onPlace: (c: City) => (area.onPlace(c), toDiscover()) };
  return { query, setQuery, scope, setScope, mine, area: lent, focused, carried: written, show, setShow, counts, setCounts };
}
