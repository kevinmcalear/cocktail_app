import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale, useDs, useGutter } from '@/components/ds';
import { PopoverMenu, usePopover } from '@/components/ds/PopoverMenu';
import { useMaterialRoles } from '@/components/nav/material';
import { HomeMark, VenueMark } from '@/components/nav/VenueMarks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, radius, space, type } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useKeyboardHeight } from '@/hooks/useKeyboardInset';
import { searchTyped } from '@/lib/searchProbe';
import { scopeOptions } from '@/lib/searchScope';
import { searchBarLabel } from '@/lib/tabs';
import { useBringIn } from '@/store/useBringIn';
import { useRecentSearches } from '@/store/useRecentSearches';

import { DISMISS, type SearchTabState } from './BottomSearch';
import { DrawnSearch } from './ResultRows';
import { SearchBody } from './SearchPanel';

const TOOL = 40;
const BACK = 48;

/**
 * Android's search, the /search page on the tab's stack (Miss-search-and): the
 * search bar on top of a tab's page (SearchBar.tsx) opens into Material's
 * search view, with the bottom nav bar put away (AppTabs.tsx). One pill holds
 * Back, the field, Clear, the camera and the place; results scroll below.
 */
export function TopSearch({ query, setQuery, scope, setScope, mine, area, focused }: SearchTabState) {
  const ds = useDs();
  const roles = useMaterialRoles();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const keyboard = useKeyboardHeight();
  const label = searchBarLabel(useSegments());
  // Bring in mounts with a session (app/_layout.tsx), so the camera does too.
  const { session } = useAuth();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  // autoFocus alone loses to the bar that opened the page; focus once it has settled.
  useEffect(() => {
    if (!focused) return;
    const t = setTimeout(() => input.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [focused]);
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const clear = () => {
    setQuery('');
    input.current?.focus();
  };
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View accessibilityRole="search" style={[styles.pill, { backgroundColor: roles.search, marginTop: insets.top + space.sm, marginHorizontal: gutter }]}>
        <PressableScale role="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
          <IconSymbol name="arrow.left" size={24} color={ds.c.ink} />
        </PressableScale>
        <TextInput
          ref={input}
          value={query}
          onChangeText={(text) => {
            searchTyped();
            setQuery(text);
          }}
          onSubmitEditing={() => useRecentSearches.getState().add(query)}
          placeholder={label}
          placeholderTextColor={ds.c.muted}
          cursorColor={ds.accentText}
          selectionColor={ds.accentText}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel={label}
          style={[styles.input, { color: ds.c.ink }]}
        />
        {query ? (
          <PressableScale role="button" accessibilityLabel="Clear the search" onPress={clear} style={styles.tool}>
            <IconSymbol name="xmark" size={22} color={ds.c.ink} />
          </PressableScale>
        ) : null}
        {session ? (
          <PressableScale role="button" accessibilityLabel="Snap a menu or bottle" onPress={() => useBringIn.getState().openSheet()} style={styles.tool}>
            <IconSymbol name="camera" size={22} color={ds.c.ink} />
          </PressableScale>
        ) : null}
        <PlaceMark scope={scope} setScope={setScope} mine={mine} area={area} />
      </View>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={DISMISS}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: space.md, paddingBottom: Math.max(keyboard, insets.bottom) + space.lg, gap: space.lg }}
      >
        <DrawnSearch value>
          <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} area={area} typeAhead={setQuery} />
        </DrawnSearch>
      </ScrollView>
    </View>
  );
}

/** The place, in the field: a tap says where to search (your place, this area, everywhere). */
function PlaceMark({ scope, setScope, mine, area }: Pick<SearchTabState, 'scope' | 'setScope' | 'mine' | 'area'>) {
  const menu = usePopover();
  const mark = useRef<ComponentRef<typeof View>>(null);
  const { active } = useActiveVenue();
  const options = scopeOptions(mine.label, area?.label ?? null);
  const items = options.map((o) => ({ label: o.label, detail: o.detail, checked: o.value === scope, onPress: () => setScope(o.value) }));
  return (
    <View ref={mark} collapsable={false}>
      <PressableScale role="button" aria-expanded={!!menu.anchor} accessibilityLabel={`Place: ${mine.venueId ? mine.label : 'Home'}. Change where to search`} onPress={() => menu.open(mark.current)} style={styles.mark}>
        {mine.venueId ? <VenueMark venue={active} size={TOOL} /> : <HomeMark size={TOOL} />}
      </PressableScale>
      <PopoverMenu anchor={menu.anchor} label="Where to search" onClose={menu.close} sections={[{ title: 'Search in', items }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minWidth: 0 },
  // Material 3's search view: 56 tall, a full pill.
  pill: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 56, paddingLeft: space.xs, paddingRight: space.sm, borderRadius: radius.pill },
  back: { width: BACK, height: BACK, alignItems: 'center', justifyContent: 'center' },
  input: { ...type.body, ...font.regular, flex: 1, minWidth: 0 },
  tool: { width: TOOL, height: TOOL, alignItems: 'center', justifyContent: 'center' },
  mark: { width: TOOL, height: TOOL, borderRadius: radius.pill, overflow: 'hidden' },
});
