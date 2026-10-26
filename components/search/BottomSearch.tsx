import { Stack } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SearchBarCommands } from 'react-native-screens';

import { DockFade, useDs, useGutter } from '@/components/ds';
import { ScreenHeader, ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { WEB_TAB_BAR_HEIGHT } from '@/components/nav/WebTabBar';
import { layout, space } from '@/constants/tokens';
import { useBottomSearchFocus } from '@/hooks/useBottomBar';
import type { SearchMine } from '@/hooks/useSearchMine';
import { scopeOptions, type SearchScope, type SearchShow, type ShowCounts } from '@/lib/searchScope';

import { CanMakeChip } from './CanMake';
import { SearchField } from './SearchField';
import { SearchBody, searchPlaceholder, type SearchArea } from './SearchPanel';
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
function PlaceRow({ query, scope, setScope, mine, area, show, setShow, counts }: Pick<SearchTabState, 'query' | 'scope' | 'setScope' | 'mine' | 'area' | 'show' | 'setShow' | 'counts'>) {
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

const DISMISS = Platform.OS === 'ios' ? 'interactive' : 'on-drag';

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
            placeholder: searchPlaceholder(scope, mine, area),
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
 * Android, phone web and iOS before 26: the field floats at the bottom in glass, with
 * the place row over it; recents and results
 * scroll above and under it (search-start, search-typing). While you type it rides on the
 * keyboard and takes the tab bar's place (Android's keyboard covers the bar;
 * phone web hides its bar); with the keyboard down it sits just above the
 * tabs. The round x empties it and puts the keyboard away.
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
  // Phone web: while the field has focus, it takes the tab bar's place.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    useBottomSearchFocus.setState({ focused: focused && fieldFocused });
    return () => useBottomSearchFocus.setState({ focused: false });
  }, [focused, fieldFocused]);
  // Room under the field: the keyboard (KeyboardAvoidingView adds it on native),
  // or else the tab bar. iOS's floating bar is in the bottom safe area; Android's
  // sits below the screen; the web's pill floats over it.
  const under = Platform.select({
    web: fieldFocused ? webKeyboard : insets.bottom + space.md + WEB_TAB_BAR_HEIGHT,
    ios: typing ? 0 : insets.bottom,
    default: 0,
  });
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <Stack.Screen options={{ headerShown: false, headerSearchBarOptions: undefined }} />
      {/* Its own box above the keyboard's padding, so the dock pins to the results' bottom edge. */}
      <View style={styles.screen}>
        <ScrollView
          style={styles.screen}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={DISMISS}
          // The web has no drag dismissal: blur the field when the results move.
          onScrollBeginDrag={Platform.OS === 'web' ? Keyboard.dismiss : undefined}
          // The last rows scroll clear of the dock floating over them.
          contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: dockHeight + space.lg, gap: space.lg }}
        >
          {/* The tab's title row, as every tab has it. */}
          <ScreenHeaderSpacer title="Search" />
          <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} area={area} onShowOnMap={onShowOnMap} show={show} onShow={setShow} onCounts={setCounts} typeAhead={setQuery} />
        </ScrollView>
        <View
          ref={dock}
          onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
          style={[styles.dock, { paddingBottom: under + space.sm }]}
        >
          <DockFade />
          <PlaceRow query={query} scope={scope} setScope={setScope} mine={mine} area={area} show={show} setShow={setShow} counts={counts} />
          <View style={{ paddingHorizontal: gutter }}>
            <SearchField query={query} onQuery={setQuery} placeholder={searchPlaceholder(scope, mine, area)} autoFocus={focused} cancel glass onFocusChange={setFieldFocused} />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Phone web: a press on the dock's chips or its place token keeps the focus
 * (and the keyboard) in the field. Otherwise the field blurs on mouse down,
 * the dock drops back above the tab bar, and the press lands on whatever
 * moved under the finger.
 */
function useKeepFieldFocus(dock: RefObject<ComponentRef<typeof View> | null>) {
  useEffect(() => {
    const el = dock.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !el?.addEventListener) return;
    const keep = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
    };
    el.addEventListener('mousedown', keep);
    return () => el.removeEventListener('mousedown', keep);
  }, [dock]);
}

/** How tall the native keyboard is, 0 while it's down (iOS hears before it moves, Android after). */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * Phone web: how much of the page the on-screen keyboard covers. Mobile
 * browsers shrink the visual viewport for it and leave the page's height
 * alone, so a field pinned to the page's bottom would sit under the keyboard.
 */
function useWebKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Floats over the results' bottom edge: the field and chips are glass, and the rows show through around them.
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'box-none', paddingTop: space.lg, gap: space.sm },
  systemDock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', pointerEvents: 'box-none' },
  systemRow: { paddingTop: space.lg, pointerEvents: 'box-none' },
  placeRow: { flexGrow: 0 },
  placeChips: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
