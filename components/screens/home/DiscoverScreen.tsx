import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Caption, Display, GlassSurface, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeader, ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { AddBarSheet } from '@/components/screens/home/AddBar';
import { ClosedBars } from '@/components/screens/home/ClosedBars';
import { areaChipLabel, FilterRow, SearchPill, type MapLayer } from '@/components/screens/home/DiscoverControls';
import { mapAvailable } from '@/components/screens/home/DiscoverMap';
import { DiscoverMapPane } from '@/components/screens/home/DiscoverMapPane';
import { DiscoverSearchHead, DiscoverSearchSheet } from '@/components/screens/home/DiscoverSearchSheet';
import { AreaSheet, FiltersSheet } from '@/components/screens/home/DiscoverSheet';
import { DrinksHere } from '@/components/screens/home/DrinksAtBars';
import { PickedBar } from '@/components/screens/home/SelectedBar';
import { ForYou } from '@/components/screens/home/FlavorRails';
import { TopBars } from '@/components/screens/home/TopBars';
import { SearchBody, type SearchArea } from '@/components/search/SearchPanel';
import { radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useDrinkPick } from '@/hooks/useDiscover';
import { useDiscoverResults } from '@/hooks/useDiscoverDrinks';
import { useDiscoverArea } from '@/hooks/useDiscoverArea';
import { useSearchMine } from '@/hooks/useSearchMine';
import { kindsTitle } from '@/lib/discoverDrinks';
import { areaFromViewport, type MapPin, type Viewport } from '@/lib/discoverMap';
import { STYLES } from '@/lib/drinkStyles';
import { areaLabel, type Area } from '@/lib/nearMe';
import type { SearchScope } from '@/lib/searchScope';
import { withAlpha } from '@/lib/color';
import { useDiscoverView } from '@/store/useDiscoverView';
import { useLastPlace } from '@/store/useLastPlace';

const ANYWHERE: Area = { kind: 'anywhere' };

/**
 * Discover, the first tab in home mode. One search pill (bars and the drinks
 * bars pour, here or everywhere), then where and Filters (styles, spirits,
 * tasting notes) in one row. Below: the drinks that match, the top bars, and
 * drinks for your taste. Phones switch between this list and a full-screen
 * map (the map first once location has been on; the last choice is
 * remembered); wide screens show both. Search, where and filters are shared
 * by both. It opens near the last place this device was found
 * (store/useLastPlace.ts) and moves when a fresh position lands elsewhere.
 */
export function DiscoverScreen() {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const signedIn = !!useAuth().user;
  const breakpoint = useBreakpoint();
  const { area, onArea, preferNear, near, onNearMe, nearIfAnywhere, locating, note } = useDiscoverArea();
  const [kinds, setKinds] = useState<string[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<SearchScope>('area');
  const mine = useSearchMine();
  const [sheet, setSheet] = useState<'search' | 'filters' | 'area' | 'add' | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  // Wide screens: the tapped pin, shown at the top of the list.
  const [picked, setPicked] = useState<MapPin | null>(null);
  // Which layer the wide map shows, so its tapped bar's card shows the same scores.
  const [mapLayer, setMapLayer] = useState<MapLayer>('drinks');
  const listRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const onPick = (pin: MapPin | null) => {
    setPicked(pin);
    if (pin) listRef.current?.scrollTo({ y: 0, animated: true });
  };
  const viewport = useRef<Viewport | null>(null);
  const onViewport = useCallback((v: Viewport | null) => {
    viewport.current = v;
  }, []);
  // Phones: the map when this device has been found before, unless it last picked the list.
  // Decided as the screen opens, so a position landing later doesn't swap the whole screen.
  const saved = useDiscoverView((s) => s.view);
  const saveView = useDiscoverView((s) => s.setView);
  const [firstView] = useState(() => (useLastPlace.getState().place ? 'map' : 'list'));
  const split = mapAvailable && breakpoint !== 'phone';
  const phoneMap = mapAvailable && !split && (saved ?? firstView) === 'map';
  const onMap = split || phoneMap;
  const toggleView = () => {
    if (phoneMap) return saveView('list');
    saveView('map');
    nearIfAnywhere();
  };

  const searching = search.trim().length > 0;
  const shownArea = searching && scope === 'everywhere' ? ANYWHERE : area;
  const filter = { kinds, search, area: shownArea };
  const results = useDiscoverResults(filter, !locating || searching);
  const title = `${searching ? `"${search.trim()}"` : kindsTitle(kinds)} ${locating && !searching ? 'near you' : areaLabel(shownArea)}`;
  const pick = useDrinkPick(search.trim() || STYLES.find((s) => kinds.includes(s.id))?.classics[0] || '');
  const drink = pick ? { id: pick.id, name: pick.name } : null;
  const hereLabel = onMap ? 'This area' : areaChipLabel(area, preferNear);
  const closed = { count: results.closed.length, shown: showClosed, onShow: setShowClosed };
  const mapResults = { ...results, title, closed: showClosed ? results.closed : [] };
  // Nearest counts from the person, else the middle of the area.
  const from = near.status === 'ready' ? near : area.kind === 'point' ? area : null;

  const openSearch = () => {
    // On the map, "this area" is what the map shows: search it, as "Search this area" would.
    if (onMap && viewport.current) onArea(areaFromViewport(viewport.current));
    if (!searching) setScope(onMap || area.kind !== 'anywhere' ? 'area' : 'everywhere');
    setSheet('search');
  };
  // "Search this area" on the map searches here, even after "Everywhere".
  const onMapArea = (next: Area) => {
    setScope('area');
    onArea(next);
  };
  const close = () => setSheet(null);
  const addKind = (k: string) => {
    setKinds((ks) => (ks.includes(k) ? ks : [...ks, k]));
    setSearch('');
    close();
  };
  // Discover's part in the one search: its filters, and its area when it isn't everywhere.
  const searchArea: SearchArea = { label: onMap || area.kind !== 'anywhere' ? hereLabel : null, area, kinds, onKind: addKind };
  // "This area" with no area left (it went back to Anywhere) searches everywhere.
  const searchScope = scope === 'area' && !searchArea.label ? 'everywhere' : scope;
  const searchProps = { query: search, onQuery: setSearch, scope: searchScope, onScope: setScope, mine, area: searchArea, onClearKinds: () => setKinds([]), onClose: close };
  const openBar = (ref: string) => {
    setSheet(null);
    router.push(`/p/${ref}`);
  };

  // Wide screens search in the list pane itself, so the map beside it stays live.
  const controls = split && sheet === 'search' ? (
    <DiscoverSearchHead {...searchProps} />
  ) : (
    <View style={styles.controls}>
      <SearchPill query={search} placeholder={onMap ? 'Search this area' : 'Search bars and drinks'} onOpen={openSearch} onClear={() => setSearch('')} />
      <FilterRow
        area={area}
        preferNear={preferNear}
        filters={kinds.length + (showClosed ? 1 : 0)}
        onArea={() => setSheet('area')}
        onFilters={() => setSheet('filters')}
        view={mapAvailable && !split ? { showing: phoneMap ? 'map' : 'list', onToggle: toggleView } : undefined}
      />
    </View>
  );

  let overlay = null;
  if (sheet === 'search' && !split) {
    overlay = <DiscoverSearchSheet {...searchProps} />;
  } else if (sheet === 'filters') {
    overlay = <FiltersSheet kinds={kinds} onChange={setKinds} bars={signedIn && results.totals ? results.totals.bars : null} closed={closed} onClose={close} />;
  } else if (sheet === 'area') {
    overlay = <AreaSheet area={area} near={near} preferNear={preferNear} onArea={onArea} onNearMe={onNearMe} onClose={close} />;
  } else if (sheet === 'add') {
    overlay = <AddBarSheet onClose={close} onAdded={(v) => openBar(v.handle)} onOpenExisting={openBar} />;
  }

  // Phones: the map fills the screen, under the header as it is under the tab bar, with the results in a sheet over it.
  if (phoneMap) {
    return (
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        <DiscoverMapPane
          mode="sheet"
          area={shownArea}
          onArea={onMapArea}
          drink={drink}
          filter={filter}
          results={mapResults}
          onViewport={onViewport}
          bottomInset={bottom}
          topInset={headerHeight}
          from={from}
          top={
            <>
              {controls}
              {note ? (
                // On glass: bare text over the map is lost under the pins.
                <GlassSurface style={styles.mapNote}>
                  <Caption role="status">{note}</Caption>
                </GlassSurface>
              ) : null}
            </>
          }
        />
        <View pointerEvents="box-none" style={styles.mapHeader} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          {/* A fade from the ground keeps the status bar and the venue name readable over the map. */}
          <LinearGradient pointerEvents="none" colors={[withAlpha(ds.c.ground, 0.9), withAlpha(ds.c.ground, 0)]} style={styles.mapFade} />
          <ScreenHeader />
        </View>
        {overlay}
      </View>
    );
  }

  const list = (
    <ScrollView
      ref={listRef}
      keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={[1]}
      style={split ? { width: breakpoint === 'desktop' ? 560 : 420, flexGrow: 0 } : undefined}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: 760, width: '100%' }}
    >
      <ScreenHeaderSpacer title={<Display>Discover</Display>} />
      <View style={[styles.sticky, { backgroundColor: ds.c.ground }]}>{controls}</View>
      <View style={styles.body}>
        {split && picked ? <PickedBar key={picked.id} pin={picked} filter={filter} best={mapLayer === 'best' ? drink : null} onClose={() => setPicked(null)} /> : null}
        {note ? (
          <Caption tone="muted" role="status">
            {note}
          </Caption>
        ) : null}
        {searching ? (
          <SearchBody query={search} scope={searchScope} onScope={setScope} mine={mine} area={searchArea} />
        ) : (
          <DrinksHere
            title={title}
            drinks={results.drinks}
            totals={results.totals}
            more={results.more}
            isLoading={results.isLoading}
            signedIn={signedIn}
            empty={`${kinds.length ? 'No drinks match your filters' : 'No drinks'} at bars ${areaLabel(area)} yet.${area.kind === 'anywhere' ? '' : ' Try Anywhere.'}`}
          />
        )}
        {searching ? null : <ClosedBars bars={results.closed} shown={showClosed} where={areaLabel(area)} onShow={setShowClosed} />}
        <TopBars area={area} />
        <ForYou />
        {signedIn ? (
          <View style={styles.add}>
            <Caption tone="muted">{"Been to a bar that isn't here?"}</Caption>
            <Button label="Add a bar" icon="plus" variant="secondary" onPress={() => setSheet('add')} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );

  return (
    <View style={[styles.screen, split ? styles.row : null, { backgroundColor: ds.c.ground }]}>
      {list}
      {split ? (
        <View style={[styles.flex, styles.mapSide, { borderLeftColor: ds.c.line }]}>
          <DiscoverMapPane mode="side" area={shownArea} onArea={onMapArea} drink={drink} filter={filter} results={mapResults} onViewport={onViewport} pick={{ id: picked?.id ?? null, onPick, onLayer: setMapLayer }} />
        </View>
      ) : null}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: 'row' },
  flex: { flex: 1, minWidth: 0 },
  mapSide: { borderLeftWidth: StyleSheet.hairlineWidth },
  mapHeader: { position: 'absolute', top: 0, left: 0, right: 0 },
  // Runs past the header so the fade ends softly over the map.
  mapFade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: -space.xl },
  mapNote: { borderRadius: radius.card, paddingHorizontal: space.lg, paddingVertical: space.md },
  controls: { gap: space.sm },
  sticky: { paddingVertical: space.md },
  body: { gap: space.xl, paddingTop: space.sm },
  add: { gap: space.sm, alignItems: 'flex-start' },
});
