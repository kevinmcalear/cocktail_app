import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, Headline, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { AddBarSheet } from '@/components/screens/home/AddBar';
import { DiscoverArea } from '@/components/screens/home/DiscoverArea';
import { DiscoverBest } from '@/components/screens/home/DiscoverBest';
import { TopBars } from '@/components/screens/home/TopBars';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useMyBar } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';
import type { Area } from '@/lib/nearMe';

/**
 * Discover, the first tab in home mode: where (near me, a city, anywhere),
 * the best of a drink there, the top bars there, then the drinks you can
 * see, marking the ones your shelf can make. ponytail: until bars can
 * publish releases (the publishing proposal), the last part is the shared
 * library; releases become a section when they exist.
 */
export function DiscoverScreen() {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const bar = useMyBar();
  const signedIn = !!useAuth().user;
  const [area, setArea] = useState<Area>({ kind: 'anywhere' });
  const [adding, setAdding] = useState(false);
  const openBar = (ref: string) => {
    setAdding(false);
    router.push(`/p/${ref}`);
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
            <DiscoverArea area={area} onChange={setArea} />
            <DiscoverBest area={area} />
            <TopBars area={area} />
            {signedIn ? (
              <View style={styles.add}>
                <Caption tone="muted">{"Been to a bar that isn't here?"}</Caption>
                <Button label="Add a bar" icon="plus" variant="secondary" onPress={() => setAdding(true)} />
              </View>
            ) : null}
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
            caption={bar.canMakeIds.has(item.id) ? 'You can make this' : undefined}
          />
        )}
      />
      {adding ? <AddBarSheet onClose={() => setAdding(false)} onAdded={(v) => openBar(v.handle)} onOpenExisting={openBar} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: space.lg, paddingBottom: space.lg },
  add: { gap: space.sm, alignItems: 'flex-start', marginTop: space.md },
  library: { gap: space.xs, marginTop: space.xl },
});
