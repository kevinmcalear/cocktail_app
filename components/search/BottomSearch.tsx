import { Stack } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SearchBarCommands } from 'react-native-screens';

import { Title, useDs, useGutter } from '@/components/ds';
import { WEB_TAB_BAR_HEIGHT } from '@/components/nav/WebTabBar';
import { layout, space } from '@/constants/tokens';
import { useBottomSearchFocus } from '@/hooks/useBottomBar';
import type { SearchMine } from '@/hooks/useSearchMine';
import type { SearchScope, SearchShow, ShowCounts } from '@/lib/searchScope';

import { SearchField } from './SearchField';
import { SearchBody, searchPlaceholder } from './SearchPanel';
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
  /** A search carried in with ?q=. */
  carried?: string;
  /** The type chips: what the results show, and how many of each they found. */
  show: SearchShow;
  setShow: (show: SearchShow) => void;
  counts: ShowCounts;
  setCounts: (counts: ShowCounts) => void;
}

/** "Little Rye ⌄" in the field: a tap flips between the venue (or your drinks) and Everywhere. */
function Token({ scope, setScope, mine }: Pick<SearchTabState, 'scope' | 'setScope' | 'mine'>) {
  return <ScopeToken label={scope === 'mine' ? mine.label : 'Everywhere'} onPress={() => setScope(scope === 'mine' ? 'everywhere' : 'mine')} />;
}

const DISMISS = Platform.OS === 'ios' ? 'interactive' : 'on-drag';

/**
 * iOS 26: the system's search tab. The screen carries a native search bar,
 * and iOS turns the tab bar into that field when the tab opens, sitting on
 * the keyboard while you type, with a button back to the tabs beside it.
 * The system field can't hold the place token or the type chips, so they
 * lead the results here. Recents and results scroll above the field;
 * dragging them pulls the keyboard down with your finger.
 */
export function SystemBottomSearch({ query, setQuery, scope, setScope, mine, focused, carried, show, setShow, counts, setCounts }: SearchTabState) {
  const ds = useDs();
  const gutter = useGutter();
  const bar = useRef<SearchBarCommands>(null);
  const keyboard = useKeyboardHeight();
  // Keyboard up every time the tab opens, as in today's search. The bar mounts with the header, a beat later.
  useEffect(() => {
    if (!focused) return;
    const t = setTimeout(() => bar.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [focused]);
  // The native field holds its own text: write a carried-in search into it.
  useEffect(() => {
    if (carried) bar.current?.setText(carried);
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
            placeholder: searchPlaceholder(scope, mine),
            autoCapitalize: 'none',
            tintColor: ds.accentText,
            hideNavigationBar: false,
            onChangeText: (e) => setQuery(e.nativeEvent.text),
            onCancelButtonPress: () => setQuery(''),
          },
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={DISMISS}
        // The last rows clear the keyboard and the field riding on it. Padding, not
        // automaticallyAdjustKeyboardInsets, which scrolls the recents off the top.
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: keyboard + layout.minTapTarget + space.xl, gap: space.lg }}
      >
        {query ? null : <Title role="heading">Search</Title>}
        <View style={styles.chipRow}>
          <Token scope={scope} setScope={setScope} mine={mine} />
          {query ? <ShowChips show={show} onShow={setShow} counts={counts} /> : null}
        </View>
        <SearchBody
          query={query}
          scope={scope}
          onScope={setScope}
          mine={mine}
          show={show}
          onCounts={setCounts}
          typeAhead={(next) => {
            bar.current?.setText(next);
            setQuery(next);
          }}
        />
      </ScrollView>
    </View>
  );
}

/**
 * Android, phone web and iOS before 26: the field docked at the bottom, with
 * where it searches inside it and the type chips over it; recents and results
 * scroll above (search-start, search-typing). While you type it rides on the
 * keyboard and takes the tab bar's place (Android's keyboard covers the bar;
 * phone web hides its bar); with the keyboard down it sits just above the
 * tabs. The round x empties it and puts the keyboard away.
 */
export function BottomSearch({ query, setQuery, scope, setScope, mine, focused, show, setShow, counts, setCounts }: SearchTabState) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const typing = useKeyboardHeight() > 0;
  const webKeyboard = useWebKeyboardInset();
  const [fieldFocused, setFieldFocused] = useState(false);
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm }]}>
      <Stack.Screen options={{ headerShown: false, headerSearchBarOptions: undefined }} />
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={DISMISS}
        // The web has no drag dismissal: blur the field when the results move.
        onScrollBeginDrag={Platform.OS === 'web' ? Keyboard.dismiss : undefined}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: space.sm, paddingBottom: space.lg, gap: space.lg }}
      >
        {query ? null : <Title role="heading">Search</Title>}
        <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} show={show} onCounts={setCounts} typeAhead={setQuery} />
      </ScrollView>
      <View ref={dock} style={[styles.dock, { paddingHorizontal: gutter, paddingBottom: under + space.sm, backgroundColor: ds.c.ground }]}>
        {query ? <ShowChips show={show} onShow={setShow} counts={counts} /> : null}
        <SearchField
          query={query}
          onQuery={setQuery}
          // Short, so the place token beside it fits.
          placeholder={scope === 'mine' ? 'Drinks, menus' : 'Bars, drinks'}
          autoFocus={focused}
          cancel
          token={<Token scope={scope} setScope={setScope} mine={mine} />}
          onFocusChange={setFieldFocused}
        />
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
  dock: { paddingTop: space.sm, gap: space.sm },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
