import { useSegments } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DsText, GlassButton, GlassSurface, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useBottomSearchFocus } from '@/hooks/useBottomBar';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useOpenSearch } from '@/hooks/useSearchFrom';
import { androidBarShown, TABS, type Tab, type TabName } from '@/lib/tabs';

export type WebTab = Tab & { icon: IconName };

const ICONS: Record<TabName, IconName> = { tonight: 'place.tonight', drinks: 'place.drinks', discover: 'place.discover', you: 'place.you' };

/** The four tabs with their icons, for the phone pill, the tablet rail and the sidebar (lib/tabs.ts). */
export const WEB_TABS: readonly WebTab[] = TABS.map((t) => ({ ...t, icon: ICONS[t.name] }));

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
  const barShown = androidBarShown(useSegments() as string[]);
  if (Platform.OS === 'web') return wide ? space.xl : bottom + WEB_TAB_BAR_HEIGHT + space.xl;
  // Android's bar is hidden on a pushed page, so the content reaches the system nav bar.
  return (Platform.OS === 'ios' || !barShown ? bottom : 0) + space.lg;
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
 * The tab bar for phone-width web: the four tabs in a glass pill, with search
 * as its own circle, like the system bar on iOS 26. The circle opens the
 * /search page on the tab's stack (components/search/SearchScreen.tsx), where
 * the bar folds down to the tab you came from beside the field. The + is in each
 * page's header (ScreenHeader.tsx).
 */
export function WebTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const openSearch = useOpenSearch();
  const current = state.routes[state.index]?.name;
  // While a bottom search field has focus (Discover's sheet) it takes the bar's place.
  const searching = useBottomSearchFocus((s) => s.focused);
  // The /search page, pushed on a tab's stack, draws its own bottom: the field and the tab it came from.
  const onSearch = (useSegments() as string[])[2] === 'search';
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (current !== name && !event.defaultPrevented) navigateToTab(route.key);
  };
  if (searching || onSearch) return null;
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + space.md }]}>
      <GlassSurface style={styles.tabs}>
        <View role="tablist" style={styles.row}>
          {WEB_TABS.map((t) => {
            const selected = current === t.route;
            const color = selected ? ds.accentText : ds.c.muted;
            return (
              <PressableScale
                key={t.name}
                role="tab"
                aria-selected={selected}
                accessibilityLabel={t.label}
                onPress={() => go(t.route)}
                style={[styles.tab, selected && { backgroundColor: ds.c.line }]}
              >
                <IconSymbol name={t.icon} size={20} color={color} />
                <DsText variant="caption" color={color} numberOfLines={1}>
                  {t.label}
                </DsText>
              </PressableScale>
            );
          })}
        </View>
      </GlassSurface>
      <GlassButton accessibilityLabel="Search" icon="magnifyingglass" size={WEB_TAB_BAR_HEIGHT} onPress={() => openSearch()} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: TAB_PILL.inset, right: TAB_PILL.inset, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tabs: { flex: 1, height: WEB_TAB_BAR_HEIGHT },
  row: { flex: 1, flexDirection: 'row', padding: space.xs },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: WEB_TAB_BAR_HEIGHT / 2, gap: 2 },
});
