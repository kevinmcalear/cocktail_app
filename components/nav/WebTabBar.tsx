import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DsText, GlassButton, GlassSurface, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FEATURES } from '@/constants/features';
import { space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';

export type WebTab = { name: string; label: string; icon: IconName };

const DISCOVER: WebTab = { name: 'discover', label: 'Discover', icon: 'safari' };

/** Prep and Study only when they're switched on (constants/features.ts). */
export const VENUE_TABS: WebTab[] = [
  { name: 'index', label: 'Tonight', icon: 'moon.stars' },
  { name: 'library', label: 'Library', icon: 'square.grid.2x2' },
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

const BAR_HEIGHT = 56;

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
  const { mode } = useMode();
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
          {(mode === 'home' ? HOME_TABS : VENUE_TABS).map((t) => {
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
                <IconSymbol name={t.icon} size={20} color={color} />
                <DsText variant="caption" color={color} numberOfLines={1}>
                  {t.label}
                </DsText>
              </PressableScale>
            );
          })}
        </View>
      </GlassSurface>
      <GlassButton accessibilityLabel="Search" icon="magnifyingglass" onPress={() => go('search')} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tabs: { flex: 1, height: BAR_HEIGHT },
  row: { flex: 1, flexDirection: 'row', padding: space.xs },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: BAR_HEIGHT / 2, gap: 2 },
});
