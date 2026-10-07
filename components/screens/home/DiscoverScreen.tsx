import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, Field, GlassButton, GlassSurface, Headline, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { AddBarSheet } from '@/components/screens/home/AddBar';
import { areaStatus, DiscoverArea } from '@/components/screens/home/DiscoverArea';
import { DiscoverBest, useDrinkPick } from '@/components/screens/home/DiscoverBest';
import { DiscoverDrinkFilters, DiscoverKinds } from '@/components/screens/home/DiscoverKinds';
import { mapAvailable } from '@/components/screens/home/DiscoverMap';
import { DiscoverMapPane } from '@/components/screens/home/DiscoverMapPane';
import { DiscoverSearchResults } from '@/components/screens/home/DiscoverSearchResults';
import { DrinksHere } from '@/components/screens/home/DrinksAtBars';
import { ForYou, MostCreative } from '@/components/screens/home/FlavorRails';
import { NewFromBars } from '@/components/screens/home/NewFromBars';
import { TopBars } from '@/components/screens/home/TopBars';
import { layout, radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useDiscoverResults } from '@/hooks/useDiscoverDrinks';
import { useFlavorCatalog, useMyTaste } from '@/hooks/useFlavor';
import { useMyBar } from '@/hooks/useHomeBar';
import { useNearMe, type NearMe } from '@/hooks/useNearMe';
import { findDrinks } from '@/lib/discover';
import { kindLabel, STYLES } from '@/lib/drinkStyles';
import { COLD_START_DRINKS, matchPercent } from '@/lib/flavor';
import { itemHref } from '@/lib/itemRoutes';
import { areaLabel, NEAR_ME_KM, type Area } from '@/lib/nearMe';

/**
 * Discover, the first tab in home mode, in the order people use it: search
 * drinks or bars, say where (near me by default, a city, anywhere) and what
 * (a style like Martinis, a spirit like Gin, or a tasting note like Smoky),
 * then the drinks bars pour there, the best-ranked of a drink, the top bars,
 * drinks for your taste and new releases, and last the drinks you can make
 * yourself. Typing swaps the browsing sections for search results. The map
 * (full screen on phones, beside the list on wide screens) pins the bars
 * pouring those drinks.
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
  const [preferNear, setPreferNear] = useState(true);
  const [kind, setKind] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const touched = useRef(false);
  const { state: near, locate } = useNearMe();
  const place = useCallback((found: NearMe) => {
    if (found.status !== 'ready') {
      setPreferNear(false);
      return;
    }
    setPreferNear(true);
    setArea({ kind: 'point', latitude: found.latitude, longitude: found.longitude, radiusKm: NEAR_ME_KM, source: 'me' });
  }, []);
  const onArea = (next: Area) => {
    touched.current = true;
    setPreferNear(next.kind === 'point' && next.source === 'me');
    setArea(next);
  };
  const onNearMe = () => {
    touched.current = true;
    setPreferNear(true);
    void locate().then(place);
  };
  useEffect(() => {
    let live = true;
    void locate().then((found) => {
      if (!live || touched.current) return;
      place(found);
    });
    return () => {
      live = false;
    };
  }, [locate, place]);
  const searching = search.trim().length > 0;
  // Search stands alone: a style picked while browsing doesn't narrow it.
  const results = useDiscoverResults({ kind: searching ? null : kind, search, area });
  const title = `${searching ? `"${search.trim()}"` : kind ? kindLabel(kind) : 'Drinks'} ${areaLabel(area)}`;
  const pick = useDrinkPick(search.trim() || STYLES.find((s) => s.id === kind)?.classics[0] || '');
  const pickKind = (k: string | null) => {
    setKind(k);
    setSearch('');
  };
  const openMap = async () => {
    setView('map');
    if (area.kind !== 'anywhere') return;
    touched.current = true;
    place(await locate());
  };
  const openBar = (ref: string) => {
    setAdding(false);
    router.push(`/p/${ref}`);
  };
  const split = mapAvailable && breakpoint !== 'phone';
  const drink = pick.drink ? { id: pick.drink.id, name: pick.drink.name } : null;
  const sheet = adding ? <AddBarSheet onClose={() => setAdding(false)} onAdded={(v) => openBar(v.handle)} onOpenExisting={openBar} /> : null;

  const { data: me } = useMyTaste();
  const catalog = useFlavorCatalog();
  // Match percentages only once your taste comes from enough rankings.
  const scored = me && me.basis === 'ranked' && me.rankedDrinks >= COLD_START_DRINKS ? me.taste : null;
  const matchFor = (id: string) => {
    const profile = scored && catalog.data?.find((d) => d.id === id)?.profile;
    return profile ? `${matchPercent(scored, profile)}% match` : null;
  };

  // Phones: the map fills the screen, with the results in a sheet over it.
  if (mapAvailable && !split && view === 'map') {
    const note = areaStatus(near);
    return (
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        <View style={{ paddingHorizontal: gutter }}>
          <ScreenHeaderSpacer />
        </View>
        <DiscoverMapPane
          mode="sheet"
          area={area}
          onArea={onArea}
          drink={drink}
          results={{ ...results, title }}
          kind={kind}
          onKind={setKind}
          bottomInset={bottom}
          top={
            <View style={styles.mapBar}>
              <GlassSurface style={styles.mapTop}>
                <DiscoverArea compact area={area} onChange={onArea} near={near} preferNear={preferNear} onNearMe={onNearMe} />
                <GlassButton accessibilityLabel="Show the list" label="List" icon="list.bullet" onPress={() => setView('list')} />
              </GlassSurface>
              {note ? (
                // On glass: bare text over the map is lost under the pins.
                <GlassSurface style={styles.mapNote}>
                  <Caption role="status">{note}</Caption>
                </GlassSurface>
              ) : null}
            </View>
          }
        />
      </View>
    );
  }

  const browse = (
    <>
      <DiscoverKinds kind={kind} onChange={setKind} />
      <DrinksHere
        title={title}
        drinks={results.drinks}
        barsById={results.barsById}
        isLoading={results.isLoading}
        signedIn={signedIn}
        empty={`No ${kind ? kindLabel(kind).toLowerCase() : 'drinks'} at bars ${areaLabel(area)} yet.${area.kind === 'anywhere' ? '' : ' Try Anywhere.'}`}
      />
      <DiscoverBest area={area} pick={pick} />
      <TopBars area={area} />
      <ForYou />
      <NewFromBars />
      <MostCreative />
      {signedIn ? (
        <View style={styles.add}>
          <Caption tone="muted">{"Been to a bar that isn't here?"}</Caption>
          <Button label="Add a bar" icon="plus" variant="secondary" onPress={() => setAdding(true)} />
        </View>
      ) : null}
    </>
  );

  const list = (
      <FlatList
        data={searching ? findDrinks(bar.drinks, search) : bar.drinks}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(d) => d.id}
        style={split ? { width: breakpoint === 'desktop' ? 560 : 420, flexGrow: 0 } : undefined}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: 760, width: '100%' }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeaderSpacer />
            <Display>Discover</Display>
            <Field
              label="Search drinks or bars"
              value={search}
              onChangeText={setSearch}
              placeholder="Martini, gin, yuzu, a bar or a city"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searching ? null : <DiscoverDrinkFilters kind={kind} onChange={setKind} />}
            <DiscoverArea area={area} onChange={onArea} near={near} preferNear={preferNear} onNearMe={onNearMe} />
            {searching ? (
              <DiscoverSearchResults
                search={search}
                area={area}
                drinks={results.drinks}
                bars={results.bars}
                barsById={results.barsById}
                isLoading={results.isLoading}
                signedIn={signedIn}
                onKind={pickKind}
              />
            ) : (
              browse
            )}
            <View style={styles.library}>
              <Headline role="heading">Make it yourself</Headline>
              <Caption tone="muted">
                {bar.shelf.length ? `${bar.canMake.length} of these you can make tonight` : 'Classics and drinks shared with you'}
              </Caption>
            </View>
          </View>
        }
        ListEmptyComponent={bar.isLoading ? undefined : <Body tone="muted">No drinks to show yet.</Body>}
        renderItem={({ item }) => (
          <DrinkRow
            name={item.name}
            href={itemHref('Cocktail', item.id)}
            itemId={item.id}
            imageUrl={item.imageUrl}
            glass={item.glass}
            caption={[bar.canMakeIds.has(item.id) ? 'You can make this' : null, matchFor(item.id)].filter(Boolean).join(' · ') || undefined}
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
          <DiscoverMapPane mode="side" area={area} onArea={onArea} drink={drink} results={{ ...results, title }} kind={kind} onKind={setKind} />
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
          <GlassButton accessibilityLabel="Show the map" label="Map" icon="map.fill" onPress={() => void openMap()} />
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
  mapBar: { gap: space.sm },
  mapNote: { borderRadius: radius.card, paddingHorizontal: space.lg, paddingVertical: space.md },
  mapTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs, height: layout.minTapTarget + space.xs * 2 },
  toggle: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  header: { gap: space.lg, paddingBottom: space.lg },
  add: { gap: space.sm, alignItems: 'flex-start', marginTop: space.md },
  library: { gap: space.xs, marginTop: space.xl },
});
