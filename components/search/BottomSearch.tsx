import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SearchBarCommands } from 'react-native-screens';

import { DockFade, GlassButton, useDs, useGutter } from '@/components/ds';
import { ScreenHeader, ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { WEB_TABS } from '@/components/nav/WebTabBar';
import { layout, space } from '@/constants/tokens';
import { SEARCH_TAB } from '@/hooks/useBottomBar';
import { useKeyboardHeight, useWebKeyboardInset } from '@/hooks/useKeyboardInset';
import { SEARCH_ANYTHING } from '@/lib/tabs';
import type { SearchMine } from '@/hooks/useSearchMine';
import { useSearchFrom } from '@/hooks/useSearchFrom';
import { scopeOptions, type SearchScope, type SearchShow, type ShowCounts } from '@/lib/searchScope';

import { CanMakeChip } from './CanMake';
import { SearchField } from './SearchField';
import { SearchBody, type SearchArea } from './SearchPanel';
import { ScopeToken, ShowChips } from './SearchParts';

/** The search tab's state, shared by the wide web's page and the two bottom layouts. */
export interface SearchTabState {
  query: string;
  setQuery: (query: string) => void;
  scope: SearchScope;
  setScope: (scope: SearchScope) => void;
  mine: SearchMine;
  /** The tab is the one showing. */
  focused: boolean;
  /** A search carried in (a ?q= link, or a door such as Discover's pill): a new object each time. */
  carried?: { query: string };
  /** The type chips: what the results show, and how many of each they found. */
  show: SearchShow;
  setShow: (show: SearchShow) => void;
  counts: ShowCounts;
  setCounts: (counts: ShowCounts) => void;
  /** Discover's area, when the search was opened from Discover. */
  area?: SearchArea | null;
  /** Searching Discover's area: show the results on its map. */
  onShowOnMap?: () => void;
}

/**
 * Over the bottom field: where it searches ("Little Rye ⌄", a menu of the
 * venue or your drinks, This area from Discover, and Everywhere), then the
 * type chips once you type. One glass row, edge to edge, so it scrolls off the
 * screen's side rather than against an edge, with the results passing under it
 * (search-typing, decided 23 Oct 2026).
 */
export function PlaceRow({ query, scope, setScope, mine, area, show, setShow, counts }: Pick<SearchTabState, 'query' | 'scope' | 'setScope' | 'mine' | 'area' | 'show' | 'setShow' | 'counts'>) {
  const gutter = useGutter();
  // At a venue on Everywhere: Can make, between the place and the type chips; on, the type chips leave (QA Q37).
  const canMake = query && scope === 'everywhere' && !!mine.venueId;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.placeRow} contentContainerStyle={[styles.placeChips, { paddingHorizontal: gutter }]}>
      <ScopeToken options={scopeOptions(mine.label, area?.label ?? null)} scope={scope} onScope={setScope} />
      {canMake ? <CanMakeChip show={show} onShow={setShow} count={counts.canmake} /> : null}
      {query && show !== 'canmake' ? <ShowChips show={show} onShow={setShow} counts={counts} /> : null}
    </ScrollView>
  );
}

/** The place row's height: the 44-point token and chip track, and the gap to the field. */
const PLACE_ROW = layout.minTapTarget + space.sm;

export const DISMISS = Platform.OS === 'ios' ? 'interactive' : 'on-drag';

/**
 * iOS 26: the system's search tab. The screen carries a native search bar,
 * and iOS turns the tab bar into that field when the tab opens, sitting on
 * the keyboard while you type, with a button back to the tabs beside it.
 * The system field can't hold the place or the type chips, so their glass
 * row floats just above it, riding the keyboard with it. Recents and results
 * scroll above and under them; dragging them pulls the keyboard down with
 * your finger.
 */
export function SystemBottomSearch({ query, setQuery, scope, setScope, mine, area, onShowOnMap, focused, carried, show, setShow, counts, setCounts }: SearchTabState) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const bar = useRef<SearchBarCommands>(null);
  const keyboard = useKeyboardHeight();
  // Keyboard up every time the tab opens, as in today's search. The bar mounts with the header, a beat later.
  useEffect(() => {
    if (!focused) return;
    const t = setTimeout(() => bar.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [focused]);
  // The native field holds its own text: write a carried-in search into it, once the bar has mounted.
  useEffect(() => {
    if (!carried) return;
    const t = setTimeout(() => bar.current?.setText(carried.query), 150);
    return () => clearTimeout(t);
  }, [carried]);
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          title: '',
          headerSearchBarOptions: {
            ref: bar,
            placeholder: SEARCH_ANYTHING,
            autoCapitalize: 'none',
            tintColor: ds.accentText,
            hideNavigationBar: false,
            onChangeText: (e) => setQuery(e.nativeEvent.text),
            onCancelButtonPress: () => setQuery(''),
          },
        }}
      />
      {/* The tab's title row, where every tab has it. Above the results rather than in them: it ends below the
          empty native bar, so the scroll view gets no inset for that bar and the title sits up top, not under it. */}
      <ScreenHeader title="Search" />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={DISMISS}
        // The last rows clear the keyboard, the field riding on it and the place row. Padding, not
        // automaticallyAdjustKeyboardInsets, which scrolls the recents off the top.
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: space.md, paddingBottom: keyboard + SYSTEM_FIELD + PLACE_ROW + space.lg, gap: space.lg }}
      >
        <SearchBody
          query={query}
          scope={scope}
          onScope={setScope}
          mine={mine}
          area={area}
          onShowOnMap={onShowOnMap}
          show={show}
          onShow={setShow}
          onCounts={setCounts}
          typeAhead={(next) => {
            bar.current?.setText(next);
            setQuery(next);
          }}
        />
      </ScrollView>
      {/* KeyboardAvoidingView moves the row in step with the keyboard and the field on it. */}
      <KeyboardAvoidingView behavior="padding" style={styles.systemDock}>
        <View style={[styles.systemRow, { paddingBottom: keyboard ? SYSTEM_FIELD : insets.bottom }]}>
          <DockFade />
          <PlaceRow query={query} scope={scope} setScope={setScope} mine={mine} area={area} show={show} setShow={setShow} counts={counts} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// The system field over the keyboard, measured on iOS 26. With the keyboard down the field rests in the
// tab bar, which the tab screen's bottom safe area already takes in.
const SYSTEM_FIELD = 64;

/**
 * Phone web and iOS before 26: the field floats at the bottom in glass, with
 * the place row over it; recents and results scroll above and under it
 * (search-start, search-typing). While you type it rides on the keyboard.
 * The round x empties it and puts the keyboard away.
 * Before iOS 26 this is the search tab, with the tab's title row and the tab
 * bar under the field. On phone web it's the /search page over the tabs: as
 * Prod-phone draws search, no top bar, and the tab you came from waits as a
 * small circle beside the field, to go back to it. Android's is TopSearch.tsx.
 */
export function BottomSearch({ query, setQuery, scope, setScope, mine, area, onShowOnMap, focused, show, setShow, counts, setCounts }: SearchTabState) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const typing = useKeyboardHeight() > 0;
  const webKeyboard = useWebKeyboardInset();
  const [fieldFocused, setFieldFocused] = useState(false);
  const [dockHeight, setDockHeight] = useState(layout.minTapTarget + space.lg);
  const dock = useRef<ComponentRef<typeof View>>(null);
  useKeepFieldFocus(dock);
  // Room under the field: the keyboard (KeyboardAvoidingView adds it on native),
  // or else iOS's floating tab bar (in the bottom safe area), or the page's bottom edge.
  const under = Platform.select({
    web: fieldFocused ? webKeyboard : insets.bottom + space.sm,
    default: typing ? 0 : insets.bottom,
  });
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {SEARCH_TAB ? <Stack.Screen options={{ headerShown: false, headerSearchBarOptions: undefined }} /> : null}
      {/* Its own box above the keyboard's padding, so the dock pins to the results' bottom edge. */}
      <View style={styles.screen}>
        <ScrollView
          style={styles.screen}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={DISMISS}
          // The web has no drag dismissal: blur the field when the results move.
          onScrollBeginDrag={Platform.OS === 'web' ? Keyboard.dismiss : undefined}
          // The last rows scroll clear of the dock floating over them; the web page starts under the status bar.
          contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: Platform.OS === 'web' ? insets.top + space.lg : 0, paddingBottom: dockHeight + space.lg, gap: space.lg }}
        >
          {/* The tab's title row, as every tab has it. */}
          {SEARCH_TAB ? <ScreenHeaderSpacer title="Search" /> : null}
          <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} area={area} onShowOnMap={onShowOnMap} show={show} onShow={setShow} onCounts={setCounts} typeAhead={setQuery} />
        </ScrollView>
        <View
          ref={dock}
          onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
          style={[styles.dock, { paddingBottom: under + space.sm }]}
        >
          <DockFade />
          <PlaceRow query={query} scope={scope} setScope={setScope} mine={mine} area={area} show={show} setShow={setShow} counts={counts} />
          <View style={[styles.fieldRow, { paddingHorizontal: gutter }]}>
            {Platform.OS === 'web' ? <BackToTab /> : null}
            <View style={styles.field}>
              <SearchField query={query} onQuery={setQuery} placeholder={SEARCH_ANYTHING} autoFocus={focused} cancel glass onFocusChange={setFieldFocused} />
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Phone web's way back from the search page: the tab you came from, as a small
 * glass circle left of the field in the accent (Prod-phone's search, the tab
 * bar folded down beside the field as iOS 26 does).
 */
function BackToTab() {
  const ds = useDs();
  const router = useRouter();
  const from = useSearchFrom((s) => s.from);
  const tab = WEB_TABS.find((t) => t.name === from) ?? WEB_TABS[0];
  const back = () => (router.canGoBack() ? router.back() : router.navigate(tab.path));
  return <GlassButton icon={tab.icon} color={ds.accentText} size={FIELD} accessibilityLabel={`Back to ${tab.label}`} onPress={back} />;
}

/** The glass field's height (SearchField), which the circle beside it matches. */
const FIELD = layout.minTapTarget + space.xs;

/**
 * Phone web: a press on the dock's chips or its place token keeps the focus
 * (and the keyboard) in the field. Otherwise the field blurs on mouse down,
 * the dock drops back above the tab bar, and the press lands on whatever
 * moved under the finger.
 */
function useKeepFieldFocus(dock: RefObject<ComponentRef<typeof View> | null>) {
  useEffect(() => {
    const el = dock.current as HTMLElement | null;
    if (Platform.OS !== 'web' || !el?.addEventListener) return;
    const keep = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
    };
    el.addEventListener('mousedown', keep);
    return () => el.removeEventListener('mousedown', keep);
  }, [dock]);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Floats over the results' bottom edge: the field and chips are glass, and the rows show through around them.
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'box-none', paddingTop: space.lg, gap: space.sm },
  systemDock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', pointerEvents: 'box-none' },
  systemRow: { paddingTop: space.lg, pointerEvents: 'box-none' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  field: { flex: 1, minWidth: 0 },
  placeRow: { flexGrow: 0 },
  placeChips: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
