import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SearchBarCommands } from 'react-native-screens';

import { useDs, useGutter } from '@/components/ds';
import { WEB_TAB_BAR_HEIGHT } from '@/components/nav/WebTabBar';
import { layout, space } from '@/constants/tokens';
import { useBottomSearchFocus } from '@/hooks/useBottomBar';
import type { SearchMine } from '@/hooks/useSearchMine';
import { scopeOptions, type SearchScope } from '@/lib/searchScope';

import { ScopeSwitch } from './ScopeSwitch';
import { SearchField } from './SearchField';
import { SearchBody, searchPlaceholder } from './SearchPanel';

/** The search tab's state, shared by today's layout and the two bottom ones. */
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
}

// ponytail: the keyboard dismissal below is this variant's own (a parallel
// session is reworking dismissal for today's search). Fold the two together
// once one layout wins.
const DISMISS = Platform.OS === 'ios' ? 'interactive' : 'on-drag';

/**
 * Settings › Try it on iOS 26: the system's search tab. The screen carries a
 * native search bar, and iOS turns the tab bar into that field when the tab
 * opens, sitting on the keyboard while you type, with a button back to the
 * tabs beside it. Recents and results scroll above it; dragging them pulls
 * the keyboard down with your finger.
 */
export function SystemBottomSearch({ query, setQuery, scope, setScope, mine, focused, carried }: SearchTabState) {
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
        <ScopeSwitch options={scopeOptions(mine.label, null)} scope={scope} onScope={setScope} />
        <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} />
      </ScrollView>
    </View>
  );
}

/**
 * Settings › Try it on Android, phone web and iOS before 26: the field docked
 * at the bottom, results and recents above it. While you type it rides on the
 * keyboard and takes the tab bar's place (Android's keyboard covers the bar;
 * phone web hides its bar); with the keyboard down it sits just above the
 * tabs. Cancel empties it and puts the keyboard away.
 */
export function BottomSearch({ query, setQuery, scope, setScope, mine, focused }: SearchTabState) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const typing = useKeyboardHeight() > 0;
  const webKeyboard = useWebKeyboardInset();
  const [fieldFocused, setFieldFocused] = useState(false);
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
        <ScopeSwitch options={scopeOptions(mine.label, null)} scope={scope} onScope={setScope} />
        <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} />
      </ScrollView>
      <View style={[styles.dock, { paddingHorizontal: gutter, paddingBottom: under + space.sm, borderTopColor: ds.c.line }]}>
        <SearchField
          query={query}
          onQuery={setQuery}
          placeholder={searchPlaceholder(scope, mine)}
          autoFocus={focused}
          cancel
          onFocusChange={setFieldFocused}
        />
      </View>
    </KeyboardAvoidingView>
  );
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
  dock: { paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
