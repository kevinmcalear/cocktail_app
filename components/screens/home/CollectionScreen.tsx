import { useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Segmented, useBreakpoint, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useMyBar } from '@/hooks/useHomeBar';

import { BarMenusForYou } from './BarMenusForYou';
import { CollectionBars } from './CollectionBars';
import { CollectionDrinks } from './CollectionDrinks';
import { CollectionMenus } from './CollectionMenus';
import { CollectionReleases } from './CollectionReleases';
import { CollectionSavedMenus } from './CollectionSavedMenus';

type Tab = 'drinks' | 'menus' | 'bars';
const TABS = [
  { value: 'drinks', label: 'Drinks' },
  { value: 'menus', label: 'Menus' },
  { value: 'bars', label: 'Bars' },
] as const;

/**
 * Collection, in home mode: everything you keep. Drinks: what you saved to
 * make at home, what you've made, and memories of bar drinks. Menus (b08,
 * options A and E): the menus you build for nights in, still building, past
 * nights, bar menus you saved, releases, then bar menus picked for you. Bars:
 * the bars you love. Boards: home-collection-drinks, -menus, -bars and
 * -desktop-menus on the whole-app canvas.
 * ponytail: one ScrollView, no virtualizing. People save dozens of drinks,
 * not thousands; make To make a FlatList if someone gets there.
 */
export function CollectionScreen() {
  const ds = useDs();
  const [tab, setTab] = useState<Tab>('drinks');
  // The desktop Menus tab is a grid of cards (home-collection-desktop-menus), up to the wide column.
  const wide = useBreakpoint() === 'desktop' && tab === 'menus';
  const column = usePageColumn(wide ? 'wide' : 'text');
  const bottom = useTabBarInset();
  const bar = useMyBar();
  const [creating, setCreating] = useState(false);
  // Where the tab's content starts in the scroll, for the Drinks counts to jump to their sections.
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const top = useRef(0);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView ref={scroll} contentContainerStyle={[column, { paddingBottom: bottom + space.lg }]}>
        <View style={styles.content}>
          <PageHeader
            title="Collection"
            width={wide ? 'wide' : 'text'}
            action={wide ? <Button label="New menu" icon="plus" variant="secondary" onPress={() => setCreating(true)} /> : undefined}
          />
          <Segmented options={TABS} value={tab} onChange={setTab} accessibilityLabel="Collection" />
          {tab === 'drinks' ? (
            <View onLayout={(e) => (top.current = e.nativeEvent.layout.y)}>
              <CollectionDrinks onJump={(y) => scroll.current?.scrollTo({ y: top.current + y - space.lg, animated: true })} />
            </View>
          ) : null}
          {tab === 'menus' ? (
            <View style={styles.menus}>
              <CollectionMenus shelf={bar} wide={wide} creating={creating} setCreating={setCreating} />
              <CollectionSavedMenus canMakeIds={bar.canMakeIds} />
              <CollectionReleases canMakeIds={bar.canMakeIds} />
              <BarMenusForYou wide={wide} />
            </View>
          ) : null}
          {tab === 'bars' ? <CollectionBars /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.xl },
  menus: { gap: space.xxl },
});
