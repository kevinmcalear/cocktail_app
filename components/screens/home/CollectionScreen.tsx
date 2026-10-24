import { useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Segmented, useBreakpoint, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { layout, space } from '@/constants/tokens';
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
 * make at home, what you've made, and memories of bar drinks. Menus: the
 * menus you build for nights in, in the Menus screen's groups
 * (menus-one-look), bar menus you saved, releases, then bar menus picked for
 * you. Bars:
 * the bars you love. Boards: home-collection-drinks, -menus, -bars and
 * -desktop-menus on the whole-app canvas.
 * ponytail: one ScrollView, no virtualizing. People save dozens of drinks,
 * not thousands; make To make a FlatList if someone gets there.
 */
export function CollectionScreen() {
  const ds = useDs();
  const [tab, setTab] = useState<Tab>('drinks');
  // The desktop Menus tab runs to the wide column for Bar menus for you; your own menus keep to the text column.
  const desk = useBreakpoint() === 'desktop';
  const wide = desk && tab === 'menus';
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
          {/* Full width on a phone; on a desktop the switch keeps to its own width, as drawn. */}
          <View style={desk ? styles.tabs : null}>
            <Segmented variant="ink" stretch options={TABS} value={tab} onChange={setTab} accessibilityLabel="Collection" />
          </View>
          {tab === 'drinks' ? (
            <View onLayout={(e) => (top.current = e.nativeEvent.layout.y)}>
              <CollectionDrinks onJump={(y) => scroll.current?.scrollTo({ y: top.current + y - space.lg, animated: true })} />
            </View>
          ) : null}
          {tab === 'menus' ? (
            <View style={styles.menus}>
              {/* Your menus, saved and collected keep to the text column; Bar menus for you runs wide. */}
              <View style={[styles.menus, wide && styles.text]}>
                <CollectionMenus shelf={bar} wide={wide} creating={creating} setCreating={setCreating} />
                <CollectionSavedMenus canMakeIds={bar.canMakeIds} />
                <CollectionReleases canMakeIds={bar.canMakeIds} />
              </View>
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
  tabs: { maxWidth: 440 },
  screen: { flex: 1 },
  content: { gap: space.xl },
  menus: { gap: space.xxl },
  text: { maxWidth: layout.page.text },
});
