import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, Display, Headline, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { useFavorites } from '@/hooks/useFavorites';
import { useMyBar } from '@/hooks/useHomeBar';
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
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const { favorites } = useFavorites();
  const bar = useMyBar();
  const hearted = useMemo(() => {
    const ids = new Set(favorites);
    return bar.drinks.filter((d) => ids.has(d.id));
  }, [favorites, bar.drinks]);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: 760, width: '100%' }}>
        <View style={styles.content}>
          <ScreenHeaderSpacer />
          <Display>Collection</Display>
          <CollectionMenus canMakeIds={bar.canMakeIds} />
          <CollectionCollected />
          {hearted.length ? (
            <View style={styles.section}>
              <Headline role="heading">Hearted</Headline>
              <Caption tone="muted">{`${hearted.length} saved with the heart on a drink page`}</Caption>
              <View role="list">
                {hearted.map((item) => (
                  <View role="listitem" key={item.id}>
                    <DrinkRow
                      name={item.name}
                      href={itemHref('Cocktail', item.id)}
                      itemId={item.id}
                      imageUrl={item.imageUrl}
                      glass={item.glass}
                      caption={bar.canMakeIds.has(item.id) ? 'You can make this' : undefined}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.xl, paddingBottom: space.lg },
  section: { gap: space.xs },
});
