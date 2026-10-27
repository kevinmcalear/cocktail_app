import { getLocales } from 'expo-localization';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, GlassSurface, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { AddBarSheet } from '@/components/screens/home/AddBar';
import { ClosedBars } from '@/components/screens/home/ClosedBars';
import { BackPill, FiltersChip, SearchPill, SheetSearch, type MapLayer } from '@/components/screens/home/DiscoverControls';
import { OptionChips, sortOptions } from '@/components/screens/home/DiscoverOptions';
import { mapAvailable } from '@/components/screens/home/DiscoverMap';
import { DiscoverHeader, ScrollAwayHeader, useScrollAway } from '@/components/screens/home/DiscoverHeader';
import { DiscoverMapPane } from '@/components/screens/home/DiscoverMapPane';
import { DiscoverSearchHead } from '@/components/screens/home/DiscoverSearchHead';
import { PlaceToken } from '@/components/screens/home/DiscoverPlace';
import { FiltersSheet } from '@/components/screens/home/DiscoverSheet';
import { DeskSearchResults } from '@/components/screens/home/DeskSearchResults';
import { FirstCards } from '@/components/screens/home/FirstCards';
import { BarAway, BrowseShelves, DrinksHere } from '@/components/screens/home/DrinksAtBars';
import { PickedBar } from '@/components/screens/home/SelectedBar';
import { SheetSearchPanel } from '@/components/screens/home/SheetSearchPanel';
import { StyleChips } from '@/components/screens/home/StyleChips';
import { MatchingBars, TopBarsList } from '@/components/screens/home/TopBars';
import { SearchBody, type SearchArea } from '@/components/search/SearchPanel';
import { HomeWeekStrip } from '@/components/screens/week/HomeWeekStrip';
import { layout, radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useDrinkPick } from '@/hooks/useDiscover';
import { useDiscoverResults } from '@/hooks/useDiscoverDrinks';
import { useDiscoverArea } from '@/hooks/useDiscoverArea';
import { useSearchMine } from '@/hooks/useSearchMine';
import { useOpenSearch, usePublishSearchArea } from '@/hooks/useSearchFrom';
import { useMode } from '@/hooks/useMode';
import { kindsTitle, pinOf } from '@/lib/discoverDrinks';
import { areaFromViewport, armBarHover, cameraOn, type MapPin, type Viewport } from '@/lib/discoverMap';
import { awayFrom } from '@/lib/directions';
import { STYLES } from '@/lib/drinkStyles';
import { areaLabel, searchHere, usesMiles, type Area } from '@/lib/nearMe';
import type { SearchScope } from '@/lib/searchScope';
import { withAlpha } from '@/lib/color';

const ANYWHERE: Area = { kind: 'anywhere' };
/**
 * Discover, the first tab in home mode, one design on every width (disc-map-sheet, approved 24 Oct,
 * as Google Maps has it): the search pill carries the place and, once a drink chip is tapped, the
 * style ("Martinis ×"); the chips then give way to its options (the order, Not had yet, Past
 * menus). Phones: the map, with the results in a sheet that swipes up into the shelves. Wide
 * screens: the same page beside the map. It opens near the last place this device was found.
 */
export function DiscoverScreen() {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const signedIn = !!useAuth().user;
  const home = useMode().mode === 'home';
  const breakpoint = useBreakpoint();
  const third = Math.min(640, Math.max(428, Math.round(useWindowDimensions().width / 3))); // Desktop's list: a third of the window, 428 to 640 (disc-desk-wide).
  const { area, onArea, onCity, preferNear, near, access, onNearMe, locating, note } = useDiscoverArea();
  // Search's Browse chips open Discover on a style (/discover?kind=negroni).
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const [kinds, setKinds] = useState<string[]>(() => (typeof kind === 'string' && kind ? [kind] : []));
  const [showClosed, setShowClosed] = useState(false);
  const [showPast, setShowPast] = useState(false); // Past menus' drinks: left out unless asked for; search finds them.
  const [notHad, setNotHad] = useState(false); // "Not had yet": your had and ranked drinks left out.
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<SearchScope>('area');
  const mine = useSearchMine();
  const [sheet, setSheet] = useState<'search' | 'filters' | 'add' | null>(null);
  const [headerHeight, setHeaderHeight] = useState(useSafeAreaInsets().top + layout.minTapTarget + space.lg);
  const away = useScrollAway();
  // The tapped pin: wide screens show it at the top of the list; the phone map's pill turns into its back arrow.
  const [picked, setPicked] = useState<MapPin | null>(null);
  const [hover, setHover] = useState<{ id: string; cam: ReturnType<typeof cameraOn>; area: Area } | null>(null);
  const [topBars, setTopBars] = useState<string | null>(null); // Top bars' See all (phones: the sheet; wide: the list), for the search it opened on.
  const listRef = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
  const onPick = (pin: MapPin | null) => (setHover(null), setPicked(pin), pin && listRef.current?.scrollTo({ y: 0, animated: true }));
  const viewport = useRef<Viewport | null>(null);
  const onViewport = useCallback((v: Viewport | null) => void (viewport.current = v), []);
  const split = mapAvailable && breakpoint !== 'phone';
  const phoneMap = mapAvailable && !split;
  const onMap = split || phoneMap;
  const searching = search.trim().length > 0;
  // The order: a style's best first, a search's best match, until the options row picks another (for that style or search).
  const sortKey = `${search.trim()}|${kinds.join()}`;
  const [sort, setSort] = useState<{ key: string; layer: MapLayer } | null>(null);
  const layer = sort?.key === sortKey ? sort.layer : !searching && kinds.length ? 'best' : 'drinks';
  const showTopBars = topBars === sortKey && !searching && !kinds.length;
  const shownArea = searching && scope === 'everywhere' ? ANYWHERE : area;
  const filter = { kinds, search, area: shownArea, notHad: signedIn && notHad };
  const results = useDiscoverResults(filter, !locating || searching, !searching && !showPast, !searching);
  const showBar = (barId: string | null) => {
    armBarHover(split || phoneMap ? barId : null, (id) => {
      const bar = results.barsById.get(id);
      const pin = bar ? pinOf(bar, bar.drinks) : null;
      if (pin) setHover((cur) => (cur?.id === pin.id && cur.area === area && cur.cam.latitude === pin.latitude && cur.cam.longitude === pin.longitude ? cur : { id: pin.id, cam: cameraOn(pin), area }));
    });
  };
  const openHover = hover?.area === area ? hover : null;
  const title = `${searching ? `"${search.trim()}"` : kindsTitle(kinds)} ${locating && !searching ? 'near you' : areaLabel(shownArea)}`;
  const pick = useDrinkPick(search.trim() || STYLES.find((s) => kinds.includes(s.id))?.classics[0] || '');
  const drink = pick ? { id: pick.id, name: pick.name } : null;
  const closed = { count: results.closed.length, shown: showClosed, onShow: setShowClosed }, past = { shown: showPast, onShow: setShowPast }, unhad = signedIn ? { shown: notHad, onShow: setNotHad } : undefined;
  const mapResults = { ...results, title, closed: showClosed ? results.closed : [], onNow: !showPast };
  const from = near.status === 'ready' ? near : area.kind === 'point' ? area : null; // Nearest counts from the person, else the area's middle.
  const me = near.status === 'ready' ? { latitude: near.latitude, longitude: near.longitude } : null; // The map's dot, and "400 m" on rows and bars.
  const imperial = usesMiles(getLocales()[0]);
  const awayFor = (barId: string) => (results.barsById.has(barId) ? awayFrom(me, results.barsById.get(barId)!, imperial) : null);
  // Wide screens, searching the area or everywhere: the list pane holds the ranked results (disc-desk-search).
  const deskSearch = split && searching && scope !== 'mine';
  const toSearch = useOpenSearch();
  const openSearch = () => {
    // On the map, "this area" is what the map shows: search it (q02, decided 24 Oct 2026), in the sheet on phones (q29-2 B, 27 Oct).
    // Phones search the map's view once the search is kept (Return, Show on the map), so Cancel changes nothing.
    if (phoneMap) return setSheet('search');
    if (onMap && viewport.current) onArea(areaFromViewport(viewport.current));
    const here = onMap || area.kind !== 'anywhere' ? 'area' : 'everywhere';
    if (!split) return toSearch({ query: search, scope: here });
    if (!searching) setScope(here);
    setSheet('search');
  };
  // "Search this area" on the map searches here, even after "Everywhere".
  const onMapArea = (next: Area) => {
    setScope('area');
    onArea(next);
  };
  const close = () => setSheet(null);
  // "This area" is what the map shows: search it, or (on the phone list) show the map to move.
  const onThisArea = () => void (viewport.current && onMapArea(areaFromViewport(viewport.current)));
  const addKind = (k: string) => {
    setKinds((ks) => (ks.includes(k) ? ks : [...ks, k]));
    setSearch('');
    close();
  };
  // Discover's part in the one search (its filters, and its area unless everywhere), lent to the search tab too. It always reads
  // "This area" (disc-search-typing); a city it names goes there, as a map search would (Kevin, 16 Oct: "copy Google Maps").
  const searchArea: SearchArea = { label: onMap || area.kind !== 'anywhere' ? 'This area' : null, area, kinds, onKind: addKind, onPlace: (c) => (setScope('area'), onCity(c), setSearch(''), close()) };
  usePublishSearchArea(searchArea, (q) => (setScope('area'), setSearch(q)));
  // "This area" with no area left (it went back to Anywhere) searches everywhere.
  const searchScope = scope === 'area' && !searchArea.label ? 'everywhere' : scope;
  const searchProps = { query: search, onQuery: setSearch, scope: searchScope, onScope: setScope, mine, area: searchArea, onClearKinds: () => setKinds([]), onClose: close };
  const openBar = (ref: string) => (setSheet(null), router.push(`/p/${ref}`));

  // A picked style is the search (Google Maps' categories): the pill shows it, × clears it, and Filters counts the rest.
  const pillQuery = search || (kinds.length ? kindsTitle(kinds) : '');
  const onClear = () => (search ? setSearch('') : setKinds([]));
  const filtersOn = (searching ? kinds.length : 0) + (showClosed ? 1 : 0) + (showPast ? 1 : 0) + (filter.notHad ? 1 : 0);
  const where = { area, preferNear, onArea, onNearMe, onThisArea };
  const onFilters = () => setSheet('filters');
  const back = phoneMap && picked ? { name: picked.name, onBack: () => setPicked(null) } : phoneMap && showTopBars ? { name: 'Top bars', onBack: () => setTopBars(null) } : null;
  // Phones on the map: search sits in the sheet, the place in a pill of its own at the top (Q29).
  const header = <DiscoverHeader query={pillQuery} onSearch={openSearch} onClear={onClear} place={<PlaceToken pill={phoneMap} {...where} />} filters={filtersOn} onFilters={onFilters} bar={back} searchBelow={phoneMap} />;
  const cards = (onGlass: boolean) => <FirstCards near={near} access={access} where={where} onNearMe={onNearMe} onGlass={onGlass} />;
  const order = { value: layer, options: sortOptions({ searching, best: !!drink, nearest: !!from }), onChange: (next: MapLayer) => setSort({ key: sortKey, layer: next }) };
  const options = (onGlass: boolean) => <OptionChips sort={order} notHad={unhad && { on: notHad, onChange: setNotHad }} past={{ on: showPast, onChange: setShowPast }} onGlass={onGlass} />;
  const chips = (onGlass: boolean) => (searching || kinds.length ? options(onGlass) : <StyleChips onGlass={onGlass} kinds={kinds} onChange={setKinds} drinks={results.drinks} />);
  const browse = !filter.notHad && !showPast ? <>{signedIn && home ? <HomeWeekStrip /> : null}<BrowseShelves filter={filter} around={results.drinks} enabled={signedIn && !results.isLoading} onKind={addKind} onTopBars={() => setTopBars(sortKey)} onShowBar={showBar} /></> : null;
  // Wide screens search in the list pane itself, so the map beside it stays live; the scopes stay while searching (disc-desk-search).
  const controls = split && (sheet === 'search' || searching) ? (
    <DiscoverSearchHead {...searchProps} filters={filtersOn} onFilters={onFilters} />
  ) : (
    <View style={styles.controls}>
      <View style={styles.searchRow}>
        <View style={styles.flex}><SearchPill query={pillQuery} placeholder="Search" label="Search bars and drinks" onOpen={openSearch} onClear={onClear} place={<PlaceToken wide {...where} />} /></View>
        <FiltersChip filters={filtersOn} onPress={onFilters} />
      </View>
      {chips(false)}
    </View>
  );

  const filterProps = { kinds, onChange: setKinds, bars: signedIn && results.totals ? results.totals.bars : null, closed, past, notHad: unhad, onClose: close };
  const overlay = <>{sheet === 'filters' ? <FiltersSheet {...filterProps} /> : sheet === 'add' ? <AddBarSheet onClose={close} onAdded={(v) => openBar(v.handle)} onOpenExisting={openBar} /> : null}</>;

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
          layer={layer}
          order={kinds.length && !searching ? options(false) : null}
          browse={browse}
          topBars={showTopBars}
          onViewport={onViewport}
          topInset={headerHeight}
          from={from}
          me={me}
          opened={openHover?.id}
          focus={openHover?.cam}
          onShowBar={showBar} pick={{ id: picked?.id ?? null, onPick: setPicked }} onFindMe={onNearMe}
          search={<SheetSearch query={pillQuery} placeholder={searchHere(area, preferNear)} onOpen={openSearch} onClear={onClear} />}
          top={
            <>
              {picked || showTopBars ? null : chips(true)}
              {/* On glass: bare text over the map is lost under the pins. */}
              {note ? <GlassSurface style={styles.mapNote}><Caption role="status">{note}</Caption></GlassSurface> : null}
              {picked || showTopBars ? null : cards(true)}
            </>
          }
        />
        <View pointerEvents="box-none" style={styles.mapHeader} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          {/* A fade from the ground keeps the status bar and the venue name readable over the map. */}
          <LinearGradient pointerEvents="none" colors={[withAlpha(ds.c.ground, 0.9), withAlpha(ds.c.ground, 0)]} style={styles.mapFade} />
          {header}
        </View>
        {sheet === 'search' ? <SheetSearchPanel query={search} placeholder={searchHere(area, preferNear)} top={headerHeight + layout.minTapTarget + space.md} scope={searchScope} onScope={setScope} mine={mine} area={searchArea} onApply={(q) => (viewport.current && onArea(areaFromViewport(viewport.current)), setScope('area'), setSearch(q), close())} onClose={close} onAddBar={signedIn ? () => setSheet('add') : undefined} /> : null}
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
      style={split ? { width: breakpoint === 'desktop' ? third : 420, flexGrow: 0 } : undefined}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, paddingTop: split ? 0 : headerHeight, maxWidth: 760, width: '100%' }}
    >
      {split ? <ScreenHeaderSpacer title="Discover" /> : null}
      {split ? <View style={[styles.sticky, { backgroundColor: ds.c.ground }]}>{controls}</View> : null}
      <View style={styles.body}>
        {split && picked && !deskSearch ? <PickedBar key={picked.id} pin={picked} filter={filter} best={layer === 'best' && kinds.length ? drink : null} me={me} onClose={() => setPicked(null)} /> : null}
        {note ? <Caption tone="muted" role="status">{note}</Caption> : null}
        {picked || showTopBars ? null : cards(false)}
        {signedIn && home && !searching && !split ? <HomeWeekStrip /> : null}
        {deskSearch ? (
          <DeskSearchResults filter={filter} drink={drink} results={results} layer={layer} options={options(false)} from={from} picked={picked} onAddBar={signedIn ? () => setSheet('add') : undefined} onShowBar={showBar} />
        ) : searching ? (
          <SearchBody query={search} scope={searchScope} onScope={setScope} mine={mine} area={searchArea} onAddBar={signedIn ? () => setSheet('add') : undefined} onShowBar={showBar} />
        ) : showTopBars ? (
          <View style={styles.topBars}>
            <BackPill name={`Top bars ${areaLabel(area)}`} onBack={() => setTopBars(null)} onOpen={() => setTopBars(null)} />
            <TopBarsList area={area} onShowBar={showBar} />
          </View>
        ) : (
          <DrinksHere
            title={title}
            drinks={results.drinks}
            more={results.more}
            isLoading={results.isLoading}
            signedIn={signedIn}
            filter={filter} onNow={!showPast} order={{ layer, drink, from }} onKind={addKind} onTopBars={() => (setTopBars(sortKey), listRef.current?.scrollTo({ y: 0, animated: false }))} onShowBar={showBar}
            empty={`${kinds.length ? 'No drinks match your filters' : 'No drinks'}${filter.notHad ? ' you haven’t had' : ''} at bars ${areaLabel(area)} yet.${area.kind === 'anywhere' ? '' : ' Try Anywhere.'}`}
          />
        )}
        {searching || showTopBars ? null : <ClosedBars bars={results.closed} shown={showClosed} where={areaLabel(area)} onShowBar={showBar} />}
        {deskSearch ? <MatchingBars area={shownArea} search={search} kinds={kinds} onShowBar={showBar} /> : null}
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
          <DiscoverMapPane mode="side" area={shownArea} onArea={onMapArea} drink={drink} filter={filter} results={mapResults} layer={layer} onViewport={onViewport} from={from} me={me} opened={openHover?.id} focus={openHover?.cam} onShowBar={showBar} pick={{ id: picked?.id ?? null, onPick }} onFindMe={onNearMe} />
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  topBars: { gap: space.md },
  sticky: { paddingVertical: space.md },
  body: { gap: space.xl, paddingTop: space.sm },
});
