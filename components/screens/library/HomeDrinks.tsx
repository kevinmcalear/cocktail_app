import { lazy, Suspense, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Segmented, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { HomeDrinkList } from './HomeDrinkList';
import { HomeShelf } from './HomeShelf';
import { TonightHead } from '@/components/screens/tonight/TonightParts';
import { space } from '@/constants/tokens';

// Menus and Bars load when picked, so Drinks' first screen doesn't carry them.
const HomeMenus = lazy(() => import('./HomeMenus').then((m) => ({ default: m.HomeMenus })));
const CollectionBars = lazy(() => import('@/components/screens/home/CollectionBars').then((m) => ({ default: m.CollectionBars })));

type Tab = 'drinks' | 'shelf' | 'menus' | 'bars';
const TABS = [
  { value: 'drinks', label: 'Drinks' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'menus', label: 'Menus' },
  { value: 'bars', label: 'Bars' },
] as const;

/**
 * Drinks in home mode (board Prod-drinks, Home): your name for the place over
 * "Drinks", then Drinks / Shelf / Menus. Drinks is what you can make, saved and ranked; Shelf your bottles; Menus the ones you build for nights in.
 * Bars you want to go to stay a fourth switch until the board says where they live.
 */
export function HomeDrinks() {
  const ds = useDs();
  const gutter = useGutter();
  const [tab, setTab] = useState<Tab>('drinks');
  const desk = useBreakpoint() === 'desktop';
  const bottom = useTabBarInset();
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom + space.lg }}>
        <View style={styles.content}>
          <View style={{ marginHorizontal: -gutter, gap: space.md }}>
            <ScreenHeader />
          </View>
          <TonightHead eyebrow="Home" title="Drinks" />
          <View style={desk ? styles.tabs : null}>
            <Segmented variant="ink" stretch options={TABS} value={tab} onChange={setTab} accessibilityLabel="Drinks" />
          </View>
          {tab === 'drinks' ? <View style={desk ? styles.table : null}><HomeDrinkList /></View> : null}
          <Suspense fallback={null}>
            {tab === 'shelf' ? <View style={desk ? styles.table : null}><HomeShelf /></View> : null}
            {tab === 'menus' ? <HomeMenus /> : null}
            {tab === 'bars' ? <View style={desk ? styles.table : null}><CollectionBars /></View> : null}
          </Suspense>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.xl },
  tabs: { maxWidth: 440 },
  table: { maxWidth: 960 },
});
