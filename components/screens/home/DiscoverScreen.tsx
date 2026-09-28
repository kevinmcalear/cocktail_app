import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, GlassButton, GlassSurface, Headline, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { AddBarSheet } from '@/components/screens/home/AddBar';
import { DiscoverArea } from '@/components/screens/home/DiscoverArea';
import { DiscoverBest, useDrinkPick } from '@/components/screens/home/DiscoverBest';
import { mapAvailable } from '@/components/screens/home/DiscoverMap';
import { DiscoverMapPane } from '@/components/screens/home/DiscoverMapPane';
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
  const breakpoint = useBreakpoint();
  const [area, setArea] = useState<Area>({ kind: 'anywhere' });
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const pick = useDrinkPick();
  const openBar = (ref: string) => {
    setAdding(false);
    router.push(`/p/${ref}`);
  };
  const split = mapAvailable && breakpoint !== 'phone';
  const drink = pick.drink ? { id: pick.drink.id, name: pick.drink.name } : null;
  const sheet = adding ? <AddBarSheet onClose={() => setAdding(false)} onAdded={(v) => openBar(v.handle)} onOpenExisting={openBar} /> : null;

  // Phones: the map fills the screen, with the results in a sheet over it.
  if (mapAvailable && !split && view === 'map') {
    return (
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        <View style={{ paddingHorizontal: gutter }}>
          <ScreenHeaderSpacer />
        </View>
        <DiscoverMapPane
          mode="sheet"
          area={area}
          onArea={setArea}
          drink={drink}
          bottomInset={bottom - space.xl}
          top={
            <GlassSurface style={styles.mapTop}>
              <View style={styles.flex}>
                <DiscoverArea area={area} onChange={setArea} />
              </View>
              <GlassButton accessibilityLabel="Show the list" label="List" icon="list.bullet" onPress={() => setView('list')} />
            </GlassSurface>
          }
        />
      </View>
    );
  }

  const list = (
      <FlatList
        data={bar.drinks}
        keyExtractor={(d) => d.id}
        style={split ? { width: breakpoint === 'desktop' ? 560 : 420, flexGrow: 0 } : undefined}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: 760, width: '100%' }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeaderSpacer />
            <Display>Discover</Display>
            <DiscoverArea area={area} onChange={setArea} />
            <DiscoverBest area={area} pick={pick} />
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
  );

  // Wide screens: the list on the left, the map on the right.
  if (split) {
    return (
      <View style={[styles.screen, styles.row, { backgroundColor: ds.c.ground }]}>
        {list}
        <View style={[styles.flex, styles.mapSide, { borderLeftColor: ds.c.line }]}>
          <DiscoverMapPane mode="side" area={area} onArea={setArea} drink={drink} />
        </View>
        {sheet}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {list}
      {mapAvailable ? (
        <View pointerEvents="box-none" style={[styles.toggle, { bottom: bottom - space.md }]}>
          <GlassButton accessibilityLabel="Show the map" label="Map" icon="map.fill" onPress={() => setView('map')} />
        </View>
      ) : null}
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: 'row' },
  flex: { flex: 1, minWidth: 0 },
  mapSide: { borderLeftWidth: StyleSheet.hairlineWidth },
  mapTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.sm },
  toggle: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  header: { gap: space.lg, paddingBottom: space.lg },
  add: { gap: space.sm, alignItems: 'flex-start', marginTop: space.md },
  library: { gap: space.xs, marginTop: space.xl },
});
