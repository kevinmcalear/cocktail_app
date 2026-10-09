import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Segmented, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useMyBar } from '@/hooks/useHomeBar';

import { CollectionDrinks } from './CollectionDrinks';
import { CollectionMenus } from './CollectionMenus';
import { CollectionReleases } from './CollectionReleases';

type Tab = 'drinks' | 'menus';
const TABS = [
  { value: 'drinks', label: 'Drinks' },
  { value: 'menus', label: 'Menus' },
] as const;

/**
 * Collection, in home mode: everything you keep. Drinks: what you saved to
 * make at home, and memories of bar drinks. Menus: the menus you build for
 * nights in, and releases you collected from bars. Design:
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
          {tab === 'drinks' ? (
            <CollectionDrinks />
          ) : (
            <View style={styles.content}>
              <CollectionMenus canMakeIds={bar.canMakeIds} />
              <CollectionReleases />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.xl },
});
