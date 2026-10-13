import { BackbarTheme, HidingHeadScroll, useDs, useGutter } from '@/components/ds';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { SearchBody, SearchHead } from '@/components/search/SearchPanel';
import { space } from '@/constants/tokens';
import { useSearchMine } from '@/hooks/useSearchMine';
import type { SearchScope } from '@/lib/searchScope';
import { Stack, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/**
 * The search circle beside the tabs: the one search, opened on the venue in
 * venue mode and on Everywhere in home mode. The field is focused, keyboard
 * up, every time the tab opens, on phones as on the web; leaving the tab or
 * a drag anywhere on the screen puts the keyboard away, and reading down the
 * results tucks the field away until a scroll back up (HidingHeadScroll).
 * Wide web opens the same search as a palette (⌘K) instead.
 */
export default function SearchScreen() {
  return (
    <BackbarTheme>
      <Stack.Screen options={{ headerShown: false }} />
      <MountOnFocus>
        <Search />
      </MountOnFocus>
    </BackbarTheme>
  );
}

function Search() {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const mine = useSearchMine();
  // ?q= carries a search in from elsewhere (My Bar's "Search every drink for “rye”").
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(q ?? '');
  const [carried, setCarried] = useState(q);
  if (q !== carried) {
    setCarried(q);
    if (q) setQuery(q);
  }
  const [picked, setScope] = useState<SearchScope | null>(null);
  const scope = picked ?? mine.defaultScope;
  // Native tabs stay mounted, so focus follows the tab rather than the first mount.
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) Keyboard.dismiss();
  }, [focused]);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top }]}>
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
