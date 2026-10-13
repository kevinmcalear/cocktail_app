import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DsText, GlassButton, GlassSurface, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FEATURES } from '@/constants/features';
import { space } from '@/constants/tokens';
import { useBottomBar, useBottomSearchFocus } from '@/hooks/useBottomBar';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';

import { CalendarDayIcon } from './CalendarDayIcon';
import { CreateSheet } from './CreateSheet';

export type WebTab = { name: string; label: string; icon: IconName };

const DISCOVER: WebTab = { name: 'discover', label: 'Discover', icon: 'safari' };

/** Prep and Study only when they're switched on (constants/features.ts). */
export const VENUE_TABS: WebTab[] = [
  { name: 'index', label: 'Tonight', icon: 'calendar' },
  { name: 'library', label: 'Library', icon: 'book' },
  FEATURES.prep && { name: 'prep', label: 'Prep', icon: 'flask' },
  FEATURES.study && { name: 'test', label: 'Study', icon: 'rectangle.stack' },
  DISCOVER,
].filter((t): t is WebTab => !!t);

export const HOME_TABS: WebTab[] = [
  DISCOVER,
  { name: 'bar', label: 'My Bar', icon: 'wineglass' },
  { name: 'collection', label: 'Collection', icon: 'bookmark' },
  { name: 'profile', label: 'You', icon: 'person.crop.circle' },
];

/** A tab's icon. 'calendar' is Tonight's page with the date on it; the rest are symbols. */
export function TabIcon({ name, size, color }: { name: IconName; size: number; color: ColorValue }) {
  return name === 'calendar' ? <CalendarDayIcon size={size} color={color} /> : <IconSymbol name={name} size={size} color={color} />;
}

// The board's pill and search circle are both 64 tall.
export const WEB_TAB_BAR_HEIGHT = 64;

/**
 * Space to leave under scrolling content so the tab bar doesn't cover the last
 * row, plus a little air. Only the web bar needs its height added. The system
 * bar (NativeTabs) is already counted in the bottom safe area on iOS, and on
 * Android it sits below the screen, so adding a bar height there left a band of
 * dead space above it.
 */
export function useTabBarInset() {
  const bottom = useSafeAreaInsets().bottom;
  const wide = useIsWideWeb();
  if (Platform.OS === 'web') return wide ? space.xl : bottom + WEB_TAB_BAR_HEIGHT + space.xl;
  return (Platform.OS === 'ios' ? bottom : 0) + space.lg;
}

/**
 * How far the top of the floating tab bar is from the bottom of a tab screen,
 * for things that sit right on it (Discover's map sheet). The web draws its
 * own bar; on iOS the system bar is inside the bottom safe area; Android's is
 * docked below the screen.
 */
export function useTabBarTop() {
  const bottom = useSafeAreaInsets().bottom;
  const wide = useIsWideWeb();
  if (Platform.OS === 'web') return wide ? 0 : bottom + space.md + WEB_TAB_BAR_HEIGHT;
  return Platform.OS === 'ios' ? bottom : 0;
}

/**
 * The pill's sides and corners, for things that match it: the board's (12 in
 * from the screen's sides, 64 tall) on the web, and the iOS 26 system bar's
 * (21 in, about 62 tall, measured on an iPhone 17 Pro).
 * ponytail: iOS doesn't report its bar's frame; measured, not read. Read it if NativeTabs ever exposes it.
 */
export const TAB_PILL = Platform.OS === 'ios' ? { inset: 21, radius: 31 } : { inset: space.md, radius: WEB_TAB_BAR_HEIGHT / 2 };

/**
 * The redesigned tab bar for phone-width web: labelled tabs in a glass pill,
 * with search as its own circle, like the system bar on iOS 26.
 */
export function WebTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const { mode } = useMode();
  const current = state.routes[state.index]?.name;
  // Settings › Try it: New joins the tabs (home mode's You makes room; the avatar opens it),
  // and while the bottom search field has focus it takes the bar's place.
  const bottomBar = useBottomBar();
  const searching = useBottomSearchFocus((s) => s.focused);
  const [creating, setCreating] = useState(false);
  const tabs = mode === 'home' ? (bottomBar ? HOME_TABS.filter((t) => t.name !== 'profile') : HOME_TABS) : VENUE_TABS;
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (current !== name && !event.defaultPrevented) navigateToTab(route.key);
  };
  if (bottomBar && searching) return null;
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + space.md }]}>
      <GlassSurface style={styles.tabs}>
        <View role="tablist" style={styles.row}>
          {tabs.map((t) => {
            const selected = current === t.name;
            const color = selected ? ds.accentText : ds.c.muted;
            return (
              <PressableScale
                key={t.name}
                role="tab"
                aria-selected={selected}
                accessibilityLabel={t.label}
                onPress={() => go(t.name)}
                style={[styles.tab, selected && { backgroundColor: ds.c.line }]}
              >
                <TabIcon name={t.icon} size={20} color={color} />
                <DsText variant="caption" color={color} numberOfLines={1}>
                  {t.label}
                </DsText>
              </PressableScale>
            );
          })}
          {bottomBar ? (
            <PressableScale role="button" accessibilityLabel="New: drink, ingredient, beer, wine, menu, bring something in, or a draft" onPress={() => setCreating(true)} style={styles.tab}>
              <IconSymbol name="plus" size={20} color={ds.c.muted} />
              <DsText variant="caption" color={ds.c.muted} numberOfLines={1}>
                New
              </DsText>
            </PressableScale>
          ) : null}
        </View>
      </GlassSurface>
      {/* While search is open, its circle is the current item: its icon takes the accent. */}
      <GlassButton accessibilityLabel={current === 'search' ? 'Search, open' : 'Search'} icon="magnifyingglass" size={WEB_TAB_BAR_HEIGHT} color={current === 'search' ? ds.accentText : undefined} onPress={() => go('search')} />
      {creating ? <CreateSheet visible onClose={() => setCreating(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: TAB_PILL.inset, right: TAB_PILL.inset, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tabs: { flex: 1, height: WEB_TAB_BAR_HEIGHT },
  row: { flex: 1, flexDirection: 'row', padding: space.xs },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: WEB_TAB_BAR_HEIGHT / 2, gap: 2 },
});
