import { BackbarTheme, useDs, useGutter } from '@/components/ds';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { SearchBody, SearchHead } from '@/components/search/SearchPanel';
import { space } from '@/constants/tokens';
import { useSearchMine } from '@/hooks/useSearchMine';
import type { SearchScope } from '@/lib/searchScope';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/**
 * The search circle beside the tabs: the one search, opened on the venue in
 * venue mode and on Everywhere in home mode. On web the field is focused as
 * soon as it opens; on iOS and Android the keyboard would cover half the
 * results, so it waits for a tap. Dragging the results puts the keyboard away.
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
  const [query, setQuery] = useState('');
  const [picked, setScope] = useState<SearchScope | null>(null);
  const scope = picked ?? mine.defaultScope;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.md }]}>
      <View style={{ paddingHorizontal: gutter, paddingBottom: space.md }}>
        <SearchHead query={query} onQuery={setQuery} scope={scope} onScope={setScope} mine={mine} autoFocus={Platform.OS === 'web'} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, gap: space.lg }}
      >
        <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
