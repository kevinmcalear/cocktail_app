import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Segmented, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useMyBar } from '@/hooks/useHomeBar';

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
 * make at home, what you've made, and memories of bar drinks. Menus: bar
 * menus you saved, the menus you build for nights in, and releases. Bars:
 * the bars you love. Design:
 * https://claude.ai/artifact/AEcT3Zz8UdmJs4UYACchuz
 * ponytail: one ScrollView, no virtualizing. People save dozens of drinks,
 * not thousands; make To make a FlatList if someone gets there.
 */
export function CollectionScreen() {
  const ds = useDs();
  const column = usePageColumn();
  const bottom = useTabBarInset();
  const bar = useMyBar();
  const [tab, setTab] = useState<Tab>('drinks');

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[column, { paddingBottom: bottom + space.lg }]}>
        <View style={styles.content}>
          <PageHeader title="Collection" />
          <Segmented options={TABS} value={tab} onChange={setTab} accessibilityLabel="Collection" />
          {tab === 'drinks' ? <CollectionDrinks /> : null}
          {tab === 'menus' ? (
            <View style={styles.content}>
              <CollectionSavedMenus canMakeIds={bar.canMakeIds} />
              <CollectionMenus canMakeIds={bar.canMakeIds} />
              <CollectionReleases />
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
});
