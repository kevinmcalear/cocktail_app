import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Caption, Display, Headline, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { useFavorites } from '@/hooks/useFavorites';
import { useMyBar } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';

/**
 * Collection, in home mode: the drinks you've saved with the heart on a drink
 * page. ponytail: saves are per device (useFavorites) and there are no bar
 * releases yet; both move to the collections tables in the publishing
 * proposal, and releases get their own section here.
 */
export function CollectionScreen() {
  const ds = useDs();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const { favorites } = useFavorites();
  const bar = useMyBar();
  const saved = useMemo(() => {
    const ids = new Set(favorites);
    return bar.drinks.filter((d) => ids.has(d.id));
  }, [favorites, bar.drinks]);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        data={saved}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: 760, width: '100%' }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeaderSpacer />
            <Display>Collection</Display>
            <Caption tone="muted">{saved.length ? `${saved.length} saved` : 'Drinks you save, all in one place'}</Caption>
          </View>
        }
        ListEmptyComponent={
          bar.isLoading ? null : (
            <View style={styles.empty}>
              <Headline>Nothing saved yet</Headline>
              <Body tone="muted">Tap the heart on any drink to keep it here.</Body>
            </View>
          )
        }
        renderItem={({ item }) => (
          <DrinkRow
            name={item.name}
            href={itemHref('Cocktail', item.id)}
            imageUrl={item.imageUrl}
            glass={item.glass}
            caption={bar.canMakeIds.has(item.id) ? 'You can make this' : undefined}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: space.xs, paddingBottom: space.lg },
  empty: { gap: space.sm, paddingVertical: space.xl },
});
