import { BackbarTheme, HidingHeadScroll, useDs, useGutter } from '@/components/ds';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { BottomSearch, SystemBottomSearch, type SearchTabState } from '@/components/search/BottomSearch';
import { SearchBody, SearchHead } from '@/components/search/SearchPanel';
import { space } from '@/constants/tokens';
import { SYSTEM_BOTTOM_SEARCH, useBottomSearch } from '@/hooks/useBottomBar';
import { useSearchMine } from '@/hooks/useSearchMine';
import type { SearchScope, SearchShow, ShowCounts } from '@/lib/searchScope';
import { Stack, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/**
 * The search circle beside the tabs: the one search, opened on the venue in
 * venue mode and on Everywhere in home mode. On phones the field sits at the
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
  // ?q= carries a search in from elsewhere (My Bar's "Search every drink for “rye”").
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(q ?? '');
  const [carried, setCarried] = useState(q);
  if (q !== carried) {
    setCarried(q);
    if (q) setQuery(q);
  }
  const [picked, pickScope] = useState<SearchScope | null>(null);
  const scope = picked ?? mine.defaultScope;
  // The type chips: All, Drinks 4, Ingredients 2. A new place starts back on All.
  const [show, setShow] = useState<SearchShow>('all');
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
  return { query, setQuery, scope, setScope, mine, focused, carried: q, show, setShow, counts, setCounts };
}

function Search({ query, setQuery, scope, setScope, mine, focused }: SearchTabState) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top }]}>
      {/* Clears what Try it's iOS 26 search set on the stack, if it was on a moment ago. */}
      <Stack.Screen options={{ headerShown: false, headerSearchBarOptions: undefined }} />
      <HidingHeadScroll
        head={<SearchHead query={query} onQuery={setQuery} scope={scope} onScope={setScope} mine={mine} autoFocus={focused} cancel />}
        headStyle={{ paddingHorizontal: gutter, paddingTop: space.md, paddingBottom: space.md }}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, gap: space.lg }}
      >
        <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} />
      </HidingHeadScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
