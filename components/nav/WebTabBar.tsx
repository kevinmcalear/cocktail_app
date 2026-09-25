import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DsText, GlassButton, GlassSurface, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

export const WEB_TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Tonight', icon: 'house.fill' },
  { name: 'library', label: 'Library', icon: 'square.grid.2x2' },
  { name: 'prep', label: 'Prep', icon: 'flask' },
  { name: 'test', label: 'Study', icon: 'book' },
];

const BAR_HEIGHT = 56;

/**
 * Space to leave under scrolling content so the floating web tab bar doesn't
 * cover it. Zero on native (NativeTabs insets content itself) and wide web.
 */
export function useTabBarInset() {
  const bottom = useSafeAreaInsets().bottom;
  const wide = useIsWideWeb();
  return Platform.OS === 'web' && !wide ? bottom + BAR_HEIGHT + space.xl : space.xl;
}

/**
 * The redesigned tab bar for phone-width web: labelled tabs in a glass pill,
 * with search as its own circle, like the system bar on iOS 26.
 */
export function WebTabBar({ state, navigation }: BottomTabBarProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (current !== name && !event.defaultPrevented) navigation.navigate(name);
  };
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + space.md }]}>
      <GlassSurface style={styles.tabs}>
        <View role="tablist" style={styles.row}>
          {WEB_TABS.map((t) => {
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
