import { FlatList, StyleSheet, View } from 'react-native';

import { Caption, Headline, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { useFavorites } from '@/hooks/useFavorites';
import { useDrinksById, useMyBar } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';

import { CollectionCollected } from './CollectionCollected';
import { CollectionMenus } from './CollectionMenus';

/**
 * Collection, in home mode: the menus you build for home, what you collected
 * from bars (releases, drinks, and past drinks you keep as memories), and the
 * drinks you hearted. ponytail: hearts are still per device (useFavorites)
 * and separate from collecting; fold them in once collecting covers every
 * drink you can read, not only published ones.
 */
export function CollectionScreen() {
  const ds = useDs();
  const column = usePageColumn();
  const bottom = useTabBarInset();
  const { favorites } = useFavorites();
  const bar = useMyBar();
  const hearted = useDrinksById(favorites).drinks;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {/* The hearted drinks are the list, so a long one only mounts what's on screen. */}
      <FlatList
        data={hearted}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.content}>
            <PageHeader title="Collection" />
            <CollectionMenus canMakeIds={bar.canMakeIds} />
            <CollectionCollected />
            {hearted.length ? (
              <View style={styles.section}>
                <Headline role="heading">Hearted</Headline>
                <Caption tone="muted">{`${hearted.length} saved with the heart on a drink page`}</Caption>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <DrinkRow
            name={item.name}
            href={itemHref('Cocktail', item.id)}
            itemId={item.id}
            imageUrl={item.imageUrl}
            glass={item.glass}
            caption={bar.canMakeIds.has(item.id) ? 'You can make this' : undefined}
          />
        )}
        contentContainerStyle={[column, { paddingBottom: bottom + space.lg }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.xl },
  section: { gap: space.xs, paddingBottom: space.xs },
});
