import { getLocales } from 'expo-localization';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Caption, GlassSurface, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { AddBarSheet } from '@/components/screens/home/AddBar';
import { ClosedBars } from '@/components/screens/home/ClosedBars';
import { FilterRow, SearchPill, type MapLayer } from '@/components/screens/home/DiscoverControls';
import { mapAvailable } from '@/components/screens/home/DiscoverMap';
import { DiscoverHeader, ScrollAwayHeader, useScrollAway } from '@/components/screens/home/DiscoverHeader';
import { DiscoverMapPane } from '@/components/screens/home/DiscoverMapPane';
import { DiscoverSearchHead, DiscoverSearchSheet } from '@/components/screens/home/DiscoverSearchSheet';
import { AreaSheet, FiltersSheet, OptionsSheet } from '@/components/screens/home/DiscoverSheet';
import { DeskSearchResults } from '@/components/screens/home/DeskSearchResults';
import { AllowLocation } from '@/components/screens/home/DiscoverArea';
import { BarAway, DrinksHere } from '@/components/screens/home/DrinksAtBars';
import { PickedBar } from '@/components/screens/home/SelectedBar';
import { ForYou } from '@/components/screens/home/FlavorRails';
import { TopBars } from '@/components/screens/home/TopBars';
import { SearchBody, type SearchArea } from '@/components/search/SearchPanel';
import { HomeWeekStrip } from '@/components/screens/week/HomeWeekStrip';
import { layout, radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useDrinkPick } from '@/hooks/useDiscover';
import { useDiscoverResults } from '@/hooks/useDiscoverDrinks';
import { useDiscoverArea } from '@/hooks/useDiscoverArea';
import { useSearchMine } from '@/hooks/useSearchMine';
import { useMode } from '@/hooks/useMode';
import { kindsTitle } from '@/lib/discoverDrinks';
import { areaFromViewport, type MapPin, type Viewport } from '@/lib/discoverMap';
import { awayFrom } from '@/lib/directions';
import { STYLES } from '@/lib/drinkStyles';
import { areaLabel, usesMiles, type Area } from '@/lib/nearMe';
import type { SearchScope } from '@/lib/searchScope';
import { withAlpha } from '@/lib/color';
import { useDiscoverView } from '@/store/useDiscoverView';
import { useLastPlace } from '@/store/useLastPlace';

const ANYWHERE: Area = { kind: 'anywhere' };

/**
 * Discover, the first tab in home mode. Phones: one header row (the logo, a
 * search pill for bars and the drinks bars pour, options for list or map,
 * where and filters, and you) that scrolls away over the list (Eddie and
 * Kevin, 13 Oct). Wide screens: the pill, then where and Filters. Below: the
 * drinks that match, the top bars, and drinks for your taste. Phones switch
 * between this list and a full-screen map (the map first once location has
 * been on; the last choice is remembered); wide screens show both. It opens
 * near the last place this device was found (store/useLastPlace.ts).
 */
export function DiscoverScreen() {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const signedIn = !!useAuth().user;
  const home = useMode().mode === 'home';
  const breakpoint = useBreakpoint();
  const { area, onArea, preferNear, near, access, onNearMe, nearIfAnywhere, locating, note } = useDiscoverArea();
  // Search's Browse chips open Discover on a style (/discover?kind=negroni).
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const [kinds, setKinds] = useState<string[]>(() => (typeof kind === 'string' && kind ? [kind] : []));
  const [showClosed, setShowClosed] = useState(false);
  const [showPast, setShowPast] = useState(false); // Past menus' drinks: left out unless asked for; search finds them.
  const [notHad, setNotHad] = useState(false); // "Not had yet": your had and ranked drinks left out.
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<SearchScope>('area');
  const mine = useSearchMine();
  const [sheet, setSheet] = useState<'search' | 'filters' | 'area' | 'options' | 'add' | null>(null);
  const [headerHeight, setHeaderHeight] = useState(useSafeAreaInsets().top + layout.minTapTarget + space.lg);
  const away = useScrollAway();
  // Wide screens: the tapped pin, shown at the top of the list.
  const [picked, setPicked] = useState<MapPin | null>(null);
  // Which layer the wide map shows, so its tapped bar's card shows the same scores.
  const [mapLayer, setMapLayer] = useState<MapLayer>('drinks');
  const listRef = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
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
  const showView = (next: 'list' | 'map') => {
    saveView(next);
    if (next === 'map') nearIfAnywhere();
  };
  const searching = search.trim().length > 0;
  const shownArea = searching && scope === 'everywhere' ? ANYWHERE : area;
  const filter = { kinds, search, area: shownArea, notHad: signedIn && notHad };
  const results = useDiscoverResults(filter, !locating || searching, !searching && !showPast);
  const title = `${searching ? `"${search.trim()}"` : kindsTitle(kinds)} ${locating && !searching ? 'near you' : areaLabel(shownArea)}`;
  const pick = useDrinkPick(search.trim() || STYLES.find((s) => kinds.includes(s.id))?.classics[0] || '');
  const drink = pick ? { id: pick.id, name: pick.name } : null;
  const closed = { count: results.closed.length, shown: showClosed, onShow: setShowClosed }, past = { shown: showPast, onShow: setShowPast }, unhad = signedIn ? { shown: notHad, onShow: setNotHad } : undefined;
  const mapResults = { ...results, title, closed: showClosed ? results.closed : [] };
  // Nearest counts from the person, else the middle of the area.
  const from = near.status === 'ready' ? near : area.kind === 'point' ? area : null;
  // Where the person is, once found: the map's dot, and "400 m" on rows and bars.
  const me = near.status === 'ready' ? { latitude: near.latitude, longitude: near.longitude } : null;
  const imperial = usesMiles(getLocales()[0]);
  const awayFor = (barId: string) => {
    const bar = results.barsById.get(barId);
    return bar ? awayFrom(me, bar, imperial) : null;
  };
  // Wide screens, searching the area or everywhere: the list pane holds the ranked results (disc-desk-search).
  const deskSearch = split && searching && scope !== 'mine';

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
  // "This area" is what the map shows: search it, or (on the phone list) show the map to move.
  const onThisArea = () => {
    if (viewport.current) onMapArea(areaFromViewport(viewport.current));
    else if (mapAvailable && !split) saveView('map');
  };
  const addKind = (k: string) => {
    setKinds((ks) => (ks.includes(k) ? ks : [...ks, k]));
    setSearch('');
    close();
  };
  // Discover's part in the one search: its filters, and its area when it isn't everywhere.
  // The scope always reads "This area" (disc-search-typing), whatever the area chip says.
  const searchArea: SearchArea = { label: onMap || area.kind !== 'anywhere' ? 'This area' : null, area, kinds, onKind: addKind };
  // "This area" with no area left (it went back to Anywhere) searches everywhere.
  const searchScope = scope === 'area' && !searchArea.label ? 'everywhere' : scope;
  const searchProps = { query: search, onQuery: setSearch, scope: searchScope, onScope: setScope, mine, area: searchArea, onClearKinds: () => setKinds([]), onClose: close };
  const openBar = (ref: string) => (setSheet(null), router.push(`/p/${ref}`));

  const filtersOn = kinds.length + (showClosed ? 1 : 0) + (showPast ? 1 : 0) + (filter.notHad ? 1 : 0);
  const header = <DiscoverHeader query={search} onMap={phoneMap} onSearch={openSearch} onClear={() => setSearch('')} filters={filtersOn} onOptions={() => setSheet('options')} />;
  // Wide screens search in the list pane itself, so the map beside it stays live; the scopes stay while searching (disc-desk-search).
  const controls = split && (sheet === 'search' || searching) ? (
    <DiscoverSearchHead {...searchProps} filters={filtersOn} onFilters={() => setSheet('filters')} />
  ) : (
    <View style={styles.controls}>
      <SearchPill query={search} placeholder={onMap ? 'Search this area' : 'Search bars and drinks'} onOpen={openSearch} onClear={() => setSearch('')} />
      <FilterRow area={area} preferNear={preferNear} filters={filtersOn} onArea={() => setSheet('area')} onFilters={() => setSheet('filters')} />
    </View>
  );

  const filterProps = { kinds, onChange: setKinds, bars: signedIn && results.totals ? results.totals.bars : null, closed, past, notHad: unhad, onClose: close };
  const where = { area, near, access, preferNear, onArea, onNearMe, onThisArea };
  let overlay = null;
  if (sheet === 'search' && !split) {
    overlay = <DiscoverSearchSheet {...searchProps} filters={filtersOn} onFilters={() => setSheet('filters')} />;
  } else if (sheet === 'filters') {
    overlay = <FiltersSheet {...filterProps} />;
  } else if (sheet === 'options') {
    overlay = <OptionsSheet {...filterProps} where={where} view={mapAvailable && !split ? { showing: phoneMap ? 'map' : 'list', onChange: showView } : undefined} />;
  } else if (sheet === 'area') {
    overlay = <AreaSheet {...where} onClose={close} />;
  } else if (sheet === 'add') {
    overlay = <AddBarSheet onClose={close} onAdded={(v) => openBar(v.handle)} onOpenExisting={openBar} />;
  }

  // Phones: the map fills the screen, under the header as it is under the tab bar, with the results in a sheet over it.
  if (phoneMap) {
    return (
      <BarAway.Provider value={awayFor}>
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        <DiscoverMapPane
          mode="sheet"
          area={shownArea}
          onArea={onMapArea}
          drink={drink}
          filter={filter}
          results={mapResults}
          onViewport={onViewport}
          topInset={headerHeight}
          from={from}
          me={me}
          top={
            note ? (
              // On glass: bare text over the map is lost under the pins.
              <GlassSurface style={styles.mapNote}>
                <Caption role="status">{note}</Caption>
                <AllowLocation near={near} access={access} onAsk={onNearMe} />
              </GlassSurface>
            ) : null
          }
        />
        <View pointerEvents="box-none" style={styles.mapHeader} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          {/* A fade from the ground keeps the status bar and the venue name readable over the map. */}
          <LinearGradient pointerEvents="none" colors={[withAlpha(ds.c.ground, 0.9), withAlpha(ds.c.ground, 0)]} style={styles.mapFade} />
          {header}
        </View>
        {overlay}
      </View>
      </BarAway.Provider>
    );
  }

  const list = (
    <Animated.ScrollView
      ref={listRef}
      keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={split ? [1] : undefined}
      onScroll={split ? undefined : away.onScroll}
      scrollEventThrottle={16}
      style={split ? { width: breakpoint === 'desktop' ? 428 : 420, flexGrow: 0 } : undefined}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, paddingTop: split ? 0 : headerHeight, maxWidth: 760, width: '100%' }}
    >
      {split ? <ScreenHeaderSpacer title="Discover" /> : null}
      {split ? <View style={[styles.sticky, { backgroundColor: ds.c.ground }]}>{controls}</View> : null}
      <View style={styles.body}>
        {split && picked && !deskSearch ? <PickedBar key={picked.id} pin={picked} filter={filter} best={mapLayer === 'best' ? drink : null} me={me} onClose={() => setPicked(null)} /> : null}
        {note ? (
          <Caption tone="muted" role="status">
            {note}
          </Caption>
        ) : null}
        {note ? <AllowLocation near={near} access={access} onAsk={onNearMe} /> : null}
        {signedIn && home && !searching && !split ? <HomeWeekStrip /> : null}
        {deskSearch ? (
          <DeskSearchResults filter={filter} drink={drink} results={results} layer={mapLayer} onLayer={setMapLayer} from={from} picked={picked} />
        ) : searching ? (
          <SearchBody query={search} scope={searchScope} onScope={setScope} mine={mine} area={searchArea} />
        ) : (
          <DrinksHere
            title={title}
            drinks={results.drinks}
            totals={results.totals}
            more={results.more}
            isLoading={results.isLoading}
            signedIn={signedIn}
            area={area}
            empty={`${kinds.length ? 'No drinks match your filters' : 'No drinks'}${filter.notHad ? ' you haven’t had' : ''} at bars ${areaLabel(area)} yet.${area.kind === 'anywhere' ? '' : ' Try Anywhere.'}`}
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
    </Animated.ScrollView>
  );

  return (
    <BarAway.Provider value={awayFor}>
    <View style={[styles.screen, split ? styles.row : null, { backgroundColor: ds.c.ground }]}>
      {list}
      {split ? null : <ScrollAwayHeader away={away} onHeight={setHeaderHeight}>{header}</ScrollAwayHeader>}
      {split ? (
        <View style={[styles.flex, styles.mapSide, { borderLeftColor: ds.c.line }]}>
          <DiscoverMapPane mode="side" area={shownArea} onArea={onMapArea} drink={drink} filter={filter} results={mapResults} onViewport={onViewport} from={from} me={me} pick={{ id: picked?.id ?? null, onPick, layer: mapLayer, onLayer: setMapLayer }} />
        </View>
      ) : null}
      {overlay}
    </View>
    </BarAway.Provider>
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
  mapNote: { borderRadius: radius.card, paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  controls: { gap: space.sm },
  sticky: { paddingVertical: space.md },
  body: { gap: space.xl, paddingTop: space.sm },
  add: { gap: space.sm, alignItems: 'flex-start' },
});
