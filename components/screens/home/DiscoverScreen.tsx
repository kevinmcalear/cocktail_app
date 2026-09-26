import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Caption, Display, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { useMyBar } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';

/**
 * Discover, the first tab in home mode: the drinks you can see, marking the
 * ones your shelf can make. ponytail: until bars can publish releases (the
 * publishing proposal), this is the shared library; releases become its top
 * section when they exist.
 */
export function DiscoverScreen() {
  const ds = useDs();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const bar = useMyBar();
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        data={bar.drinks}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: 760, width: '100%' }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeaderSpacer />
            <Display>Discover</Display>
            <Caption tone="muted">
              {bar.shelf.length ? `${bar.canMake.length} of these you can make tonight` : 'Classics and drinks shared with you'}
            </Caption>
          </View>
        }
        ListEmptyComponent={bar.isLoading ? null : <Body tone="muted">No drinks to show yet.</Body>}
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
});
