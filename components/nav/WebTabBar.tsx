import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DsText, GlassButton, GlassSurface, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { PHONE_TAB_LIMIT, venueTabs, type VenueTab } from '@/lib/venueFeatures';

import { CalendarDayIcon } from './CalendarDayIcon';

export type WebTab = { name: string; label: string; icon: IconName };

const DISCOVER: WebTab = { name: 'discover', label: 'Discover', icon: 'safari' };

const VENUE_TABS: Record<VenueTab, WebTab> = {
  index: { name: 'index', label: 'Tonight', icon: 'calendar' },
  library: { name: 'library', label: 'Library', icon: 'book' },
  menus: { name: 'menus', label: 'Menus', icon: 'text.alignleft' },
  prep: { name: 'prep', label: 'Prep', icon: 'flask' },
  test: { name: 'test', label: 'Study', icon: 'rectangle.stack' },
  discover: DISCOVER,
};

export const HOME_TABS: WebTab[] = [
  DISCOVER,
  { name: 'bar', label: 'My Bar', icon: 'wineglass' },
  { name: 'collection', label: 'Collection', icon: 'bookmark' },
  { name: 'profile', label: 'You', icon: 'person.crop.circle' },
];

/**
 * The tabs for the mode you're in. At a venue: Library, Menus and Discover,
 * plus Tonight, Prep and Study when the venue switched them on
 * (lib/venueFeatures.ts). Phone bars pass PHONE_TAB_LIMIT; the sidebar lists all.
 */
export function useModeTabs(limit?: number): WebTab[] {
  const { mode } = useMode();
  const { has } = useVenueFeatures();
  return mode === 'home' ? HOME_TABS : venueTabs(has, limit).map((name) => VENUE_TABS[name]);
}

/** A tab's icon. 'calendar' is Tonight's page with the date on it; the rest are symbols. */
export function TabIcon({ name, size, color }: { name: IconName; size: number; color: ColorValue }) {
  return name === 'calendar' ? <CalendarDayIcon size={size} color={color} /> : <IconSymbol name={name} size={size} color={color} />;
}

// The board's pill and search circle are both 64 tall.
const BAR_HEIGHT = 64;

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
  if (Platform.OS === 'web') return wide ? space.xl : bottom + BAR_HEIGHT + space.xl;
  return (Platform.OS === 'ios' ? bottom : 0) + space.lg;
}

/**
 * The redesigned tab bar for phone-width web: labelled tabs in a glass pill,
 * with search as its own circle, like the system bar on iOS 26.
 */
export function WebTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const tabs = useModeTabs(PHONE_TAB_LIMIT);
  const current = state.routes[state.index]?.name;
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (current !== name && !event.defaultPrevented) navigateToTab(route.key);
  };
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
        </View>
      </GlassSurface>
      {/* While search is open, its circle is the current item: its icon takes the accent. */}
      <GlassButton accessibilityLabel={current === 'search' ? 'Search, open' : 'Search'} icon="magnifyingglass" size={BAR_HEIGHT} color={current === 'search' ? ds.accentText : undefined} onPress={() => go('search')} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tabs: { flex: 1, height: BAR_HEIGHT },
  row: { flex: 1, flexDirection: 'row', padding: space.xs },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: BAR_HEIGHT / 2, gap: 2 },
});
