import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';

import { useDs, useGutter } from '@/components/ds';
import { useTabBarTop } from '@/components/nav/WebTabBar';
import { SearchField } from '@/components/search/SearchField';
import { SearchBody, type SearchArea } from '@/components/search/SearchPanel';
import { space } from '@/constants/tokens';
import { useBottomSearchFocus } from '@/hooks/useBottomBar';
import { useKeyboardHeight, useWebKeyboardInset } from '@/hooks/useKeyboardInset';
import type { SearchMine } from '@/hooks/useSearchMine';
import { withAlpha } from '@/lib/color';
import type { SearchScope } from '@/lib/searchScope';

import { Grabber, SheetGround } from './mapSheetChrome';

interface SheetSearchPanelProps {
  /** Discover's search when the field was tapped: the field starts with it. */
  query: string;
  /** "Search near you": the same words as the field in the sheet. */
  placeholder: string;
  /** Where the sheet tops out: under the header and the drink chips, so the map still shows above it. */
  top: number;
  scope: SearchScope;
  onScope: (scope: SearchScope) => void;
  mine: SearchMine;
  area: SearchArea;
  /** Return, or Show on the map: the map and its sheet show this search. */
  onApply: (query: string) => void;
  /** Cancel, a tap on the map, Escape or Android's back: the search stays as it was. */
  onClose: () => void;
  onAddBar?: () => void;
}

const DISMISS = Platform.OS === 'ios' ? 'interactive' : 'on-drag';
const RISE_MS = 240;

/**
 * Phones: Discover's search in its own sheet (q29-2 B, Kevin's pick 27 Oct;
 * KRE17 disc-sheet-search). A tap on the sheet's field raises the sheet with
 * the keyboard rather than switching to the Search tab: the field rides just
 * above the keys, recent searches and results fill the sheet, and the map and
 * the place stay behind it, dimmed. Cancel drops it back.
 */
export function SheetSearchPanel({ query: start, placeholder, top, scope, onScope, mine, area, onApply, onClose, onAddBar }: SheetSearchPanelProps) {
  const ds = useDs();
  const gutter = useGutter();
  const [query, setQuery] = useState(start);
  const [focused, setFocused] = useState(false);
  // The web can't focus the field while the sheet is still sliding in: focus it once it's up.
  const [up, setUp] = useState(Platform.OS !== 'web');
  useEffect(() => {
    const t = setTimeout(() => setUp(true), RISE_MS);
    return () => clearTimeout(t);
  }, []);
  const typing = useKeyboardHeight() > 0;
  const webKeyboard = useWebKeyboardInset();
  const tabBar = useTabBarTop();
  // Phone web: while the field has focus the tab bar steps aside, as it does for the Search tab.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    useBottomSearchFocus.setState({ focused });
    return () => useBottomSearchFocus.setState({ focused: false });
  }, [focused]);
  // Android's back closes it, only while Discover is the tab showing (native tabs keep it mounted behind the others).
  const shown = useIsFocused();
  const close = useEffectEvent(onClose);
  useEffect(() => {
    if (!shown) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => (close(), true));
    return () => back.remove();
  }, [shown]);
  // Under the field: the keyboard (KeyboardAvoidingView adds it on native, the web's inset here), or else the tab bar.
  const under = Platform.OS === 'web' ? (focused ? webKeyboard : tabBar) : typing ? 0 : tabBar;
  const apply = () => onApply(query);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable role="button" accessibilityLabel="Close the search" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(ds.c.ground, 0.45) }]} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} pointerEvents="box-none" style={[styles.fill, { paddingTop: top }]}>
        <Animated.View entering={SlideInDown.duration(RISE_MS)} role="dialog" aria-label={placeholder} style={[styles.fill, { paddingBottom: under + space.sm }]}>
          <SheetGround style={StyleSheet.absoluteFill} />
          <Grabber />
          <ScrollView style={styles.fill} keyboardShouldPersistTaps="handled" keyboardDismissMode={DISMISS} contentContainerStyle={[styles.results, { paddingHorizontal: gutter }]}>
            <SearchBody query={query} scope={scope} onScope={onScope} mine={mine} area={area} onShowOnMap={apply} onAddBar={onAddBar} />
          </ScrollView>
          <View style={{ paddingHorizontal: gutter, paddingTop: space.sm }}>
            <SearchField query={query} onQuery={setQuery} placeholder={placeholder} autoFocus={up} onSubmit={apply} onDone={onClose} doneLabel="Cancel" onFocusChange={setFocused} />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  results: { gap: space.lg, paddingBottom: space.lg },
});
