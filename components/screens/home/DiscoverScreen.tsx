import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Caption, Display, Headline, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { DiscoverBest } from '@/components/screens/home/DiscoverBest';
import { ForYou, MostCreative } from '@/components/screens/home/FlavorRails';
import { space } from '@/constants/tokens';
import { useFlavorCatalog, useMyTaste } from '@/hooks/useFlavor';
import { useMyBar } from '@/hooks/useHomeBar';
import { COLD_START_DRINKS, matchPercent } from '@/lib/flavor';
import { itemHref } from '@/lib/itemRoutes';

/**
 * Discover, the first tab in home mode: drinks for your taste, the best of a
 * drink in an area, the most creative drinks, then the drinks you can see,
 * marking the ones your shelf can make and how well each fits your taste. ponytail:
 * until bars can publish releases (the publishing proposal), the second part
 * is the shared library; releases become a section when they exist.
 */
export function DiscoverScreen() {
  const ds = useDs();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const bar = useMyBar();
  const { data: me } = useMyTaste();
  const catalog = useFlavorCatalog();
  // Match percentages only once your taste comes from enough rankings.
  const scored = me && me.basis === 'ranked' && me.rankedDrinks >= COLD_START_DRINKS ? me.taste : null;
  const matchFor = (id: string) => {
    const profile = scored && catalog.data?.find((d) => d.id === id)?.profile;
    return profile ? `${matchPercent(scored, profile)}% match` : null;
  };
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
            <ForYou />
            <DiscoverBest />
            <MostCreative />
            <View style={styles.library}>
              <Headline role="heading">Make it yourself</Headline>
              <Caption tone="muted">
                {bar.shelf.length ? `${bar.canMake.length} of these you can make tonight` : 'Classics and drinks shared with you'}
              </Caption>
            </View>
          </View>
        }
        ListEmptyComponent={bar.isLoading ? null : <Body tone="muted">No drinks to show yet.</Body>}
        renderItem={({ item }) => (
          <DrinkRow
            name={item.name}
            href={itemHref('Cocktail', item.id)}
            imageUrl={item.imageUrl}
            glass={item.glass}
            caption={[bar.canMakeIds.has(item.id) ? 'You can make this' : null, matchFor(item.id)].filter(Boolean).join(' · ') || undefined}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: space.lg, paddingBottom: space.lg },
  library: { gap: space.xs, marginTop: space.xl },
});
