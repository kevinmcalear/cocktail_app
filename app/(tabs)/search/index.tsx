import { BackbarTheme, HidingHeadScroll, useDs, useGutter } from '@/components/ds';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { BottomSearch, SystemBottomSearch, type SearchTabState } from '@/components/search/BottomSearch';
import { SearchBody, SearchHead } from '@/components/search/SearchPanel';
import { space } from '@/constants/tokens';
import { SYSTEM_BOTTOM_SEARCH, useBottomSearch } from '@/hooks/useBottomBar';
import { useSearchMine } from '@/hooks/useSearchMine';
import { useSearchFrom } from '@/hooks/useSearchFrom';
import type { City } from '@/lib/discover';
import { startScope, type SearchScope, type SearchShow, type ShowCounts } from '@/lib/searchScope';
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/**
 * The search circle beside the tabs: the one search, opened where you came
 * from (search-starts-here, 22 Oct 2026): Discover's area from Discover, else
 * the venue in venue mode and Everywhere in home mode. On phones the field sits at the
 * bottom, over the keyboard (components/search/BottomSearch.tsx); it's
 * focused, keyboard up, every time the tab opens, and leaving the tab puts
 * the keyboard away. Wide web opens the same search as a palette (⌘K); its
 * /search page keeps the field at the top, tucked away while reading down
 * the results (HidingHeadScroll).
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
  const state = useSearchTabState();
  const bottom = useBottomSearch();
  if (!bottom) return <Search {...state} />;
  return SYSTEM_BOTTOM_SEARCH ? <SystemBottomSearch {...state} /> : <BottomSearch {...state} />;
}

function useSearchTabState(): SearchTabState {
  const mine = useSearchMine();
  const router = useRouter();
  // ?q= carries a search in from elsewhere (My Bar's "Search every drink for “rye”"),
  // and ?scope=everywhere where it starts (Library's "Search everywhere for “neg”").
  const { q, scope: carriedScope } = useLocalSearchParams<{ q?: string; scope?: string }>();
  const everywhere = carriedScope === 'everywhere' ? 'everywhere' : null;
  const { from, area, showOnMap } = useSearchFrom();
  const [query, setQuery] = useState(q ?? '');
  const [carried, setCarried] = useState(q);
  const [picked, pickScope] = useState<SearchScope | null>(everywhere);
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
  // A search carried in (Library's "Search everywhere for “neg”") starts where it says.
  if (q !== carried) {
    setCarried(q);
    if (q) setQuery(q);
    if (everywhere) pickScope(everywhere);
  }
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
  return { query, setQuery, scope, setScope, mine, area: lent, onShowOnMap, focused, carried: q, show, setShow, counts, setCounts };
}

function Search({ query, setQuery, scope, setScope, mine, area, onShowOnMap, focused }: SearchTabState) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top }]}>
      {/* Clears what Try it's iOS 26 search set on the stack, if it was on a moment ago. */}
      <Stack.Screen options={{ headerShown: false, headerSearchBarOptions: undefined }} />
      <HidingHeadScroll
        head={<SearchHead query={query} onQuery={setQuery} scope={scope} onScope={setScope} mine={mine} area={area} autoFocus={focused} cancel />}
        headStyle={{ paddingHorizontal: gutter, paddingTop: space.md, paddingBottom: space.md }}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, gap: space.lg }}
      >
        <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} area={area} onShowOnMap={onShowOnMap} />
      </HidingHeadScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
