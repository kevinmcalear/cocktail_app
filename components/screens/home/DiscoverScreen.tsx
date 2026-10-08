import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Caption, Display, GlassSurface, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { EightBallButton } from '@/components/screens/eightball/EightBallProvider';
import { AddBarSheet } from '@/components/screens/home/AddBar';
import { areaStatus } from '@/components/screens/home/DiscoverArea';
import { areaChipLabel, FilterRow, SearchPill } from '@/components/screens/home/DiscoverControls';
import { mapAvailable } from '@/components/screens/home/DiscoverMap';
import { DiscoverMapPane } from '@/components/screens/home/DiscoverMapPane';
import { DiscoverSearchHead, DiscoverSearchSheet } from '@/components/screens/home/DiscoverSearchSheet';
import { AreaSheet, FiltersSheet } from '@/components/screens/home/DiscoverSheet';
import { DrinksHere } from '@/components/screens/home/DrinksAtBars';
import { ForYou } from '@/components/screens/home/FlavorRails';
import { TopBars } from '@/components/screens/home/TopBars';
import { SearchBody, type SearchArea } from '@/components/search/SearchPanel';
import { radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useDrinkPick } from '@/hooks/useDiscover';
import { useDiscoverResults } from '@/hooks/useDiscoverDrinks';
import { useNearMe, type NearMe } from '@/hooks/useNearMe';
import { useSearchMine } from '@/hooks/useSearchMine';
import { kindsTitle } from '@/lib/discoverDrinks';
import { areaFromViewport, type Viewport } from '@/lib/discoverMap';
import { STYLES } from '@/lib/drinkStyles';
import { areaLabel, NEAR_ME_KM, type Area } from '@/lib/nearMe';
import type { SearchScope } from '@/lib/searchScope';
import { useDiscoverView } from '@/store/useDiscoverView';

const ANYWHERE: Area = { kind: 'anywhere' };

/**
 * Discover, the first tab in home mode. One search pill (bars and the drinks
 * bars pour, here or everywhere), then where and Filters (styles, spirits,
 * tasting notes) in one row. Below: the drinks that match, the top bars, and
 * drinks for your taste. Phones switch between this list and a full-screen
 * map (the map first once location is on; the last choice is remembered);
 * wide screens show both. Search, where and filters are shared by both.
 */
export function DiscoverScreen() {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const signedIn = !!useAuth().user;
  const breakpoint = useBreakpoint();
  const [area, setArea] = useState<Area>(ANYWHERE);
  const [preferNear, setPreferNear] = useState(true);
  const [kinds, setKinds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<SearchScope>('area');
  const mine = useSearchMine();
  const [sheet, setSheet] = useState<'search' | 'filters' | 'area' | 'add' | null>(null);
  const viewport = useRef<Viewport | null>(null);
  const onViewport = useCallback((v: Viewport | null) => {
    viewport.current = v;
  }, []);
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
  // Ask once Discover is on screen, not when it mounts: native tabs mount every tab up front, so in
  // venue mode it sits behind Tonight (and their per-tab focus isn't reliable for this).
  const onScreen = usePathname() === '/discover';
  const asked = useRef(false);
  useEffect(() => {
    if (!onScreen || asked.current) return;
    asked.current = true;
    void locate().then((found) => {
      if (!touched.current) place(found);
    });
  }, [onScreen, locate, place]);

  // Phones: the map once location is on, unless this device last picked the list.
  const saved = useDiscoverView((s) => s.view);
  const saveView = useDiscoverView((s) => s.setView);
  const split = mapAvailable && breakpoint !== 'phone';
  const phoneMap = mapAvailable && !split && (saved ?? (near.status === 'ready' ? 'map' : 'list')) === 'map';
  const onMap = split || phoneMap;
  const toggleView = async () => {
    if (phoneMap) return saveView('list');
    saveView('map');
    if (area.kind !== 'anywhere') return;
    touched.current = true;
    place(await locate());
  };

  const searching = search.trim().length > 0;
  const shownArea = searching && scope === 'everywhere' ? ANYWHERE : area;
  const results = useDiscoverResults({ kinds, search, area: shownArea });
  const title = `${searching ? `"${search.trim()}"` : kindsTitle(kinds)} ${areaLabel(shownArea)}`;
  const pick = useDrinkPick(search.trim() || STYLES.find((s) => kinds.includes(s.id))?.classics[0] || '');
  const drink = pick ? { id: pick.id, name: pick.name } : null;
  const hereLabel = onMap ? 'This area' : areaChipLabel(area, preferNear);
  const note = areaStatus(near);

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
  // Discover's part in the one search: its area (when it isn't everywhere) and filters.
  const searchArea: SearchArea | null = onMap || area.kind !== 'anywhere' ? { label: hereLabel, area, kinds, onKind: addKind } : null;
  const searchProps = { query: search, onQuery: setSearch, scope, onScope: setScope, mine, area: searchArea, onClearKinds: () => setKinds([]), onClose: close };
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
        filters={kinds.length}
        onArea={() => setSheet('area')}
        onFilters={() => setSheet('filters')}
        view={mapAvailable && !split ? { showing: phoneMap ? 'map' : 'list', onToggle: () => void toggleView() } : undefined}
      />
    </View>
  );

  let overlay = null;
  if (sheet === 'search' && !split) {
    overlay = <DiscoverSearchSheet {...searchProps} />;
  } else if (sheet === 'filters') {
    overlay = <FiltersSheet kinds={kinds} onChange={setKinds} bars={signedIn && !results.isLoading ? new Set(results.drinks.map((d) => d.barId)).size : null} onClose={close} />;
  } else if (sheet === 'area') {
    overlay = <AreaSheet area={area} near={near} preferNear={preferNear} onArea={onArea} onNearMe={onNearMe} onClose={close} />;
  } else if (sheet === 'add') {
    overlay = <AddBarSheet onClose={close} onAdded={(v) => openBar(v.handle)} onOpenExisting={openBar} />;
  }

  // Phones: the map fills the screen, with the results in a sheet over it.
  if (phoneMap) {
    return (
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        <View style={{ paddingHorizontal: gutter }}>
          <ScreenHeaderSpacer />
        </View>
        <DiscoverMapPane
          mode="sheet"
          area={shownArea}
          onArea={onMapArea}
          drink={drink}
          results={{ ...results, title }}
          onViewport={onViewport}
          bottomInset={bottom}
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
        {overlay}
      </View>
    );
  }

  const list = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={[1]}
      style={split ? { width: breakpoint === 'desktop' ? 560 : 420, flexGrow: 0 } : undefined}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: 760, width: '100%' }}
    >
      <View>
        <ScreenHeaderSpacer />
        <View style={styles.titleRow}>
          <Display>Discover</Display>
          <EightBallButton />
        </View>
      </View>
      <View style={[styles.sticky, { backgroundColor: ds.c.ground }]}>{controls}</View>
      <View style={styles.body}>
        {note ? (
          <Caption tone="muted" role="status">
            {note}
          </Caption>
        ) : null}
        {searching ? (
          <SearchBody query={search} scope={scope} onScope={setScope} mine={mine} area={searchArea} />
        ) : (
          <DrinksHere
            title={title}
            drinks={results.drinks}
            barsById={results.barsById}
            isLoading={results.isLoading}
            signedIn={signedIn}
            empty={`${kinds.length ? 'No drinks match your filters' : 'No drinks'} at bars ${areaLabel(area)} yet.${area.kind === 'anywhere' ? '' : ' Try Anywhere.'}`}
          />
        )}
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
          <DiscoverMapPane mode="side" area={shownArea} onArea={onMapArea} drink={drink} results={{ ...results, title }} onViewport={onViewport} />
        </View>
      ) : null}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  row: { flexDirection: 'row' },
  flex: { flex: 1, minWidth: 0 },
  mapSide: { borderLeftWidth: StyleSheet.hairlineWidth },
  mapNote: { borderRadius: radius.card, paddingHorizontal: space.lg, paddingVertical: space.md },
  controls: { gap: space.sm },
  sticky: { paddingVertical: space.md },
  body: { gap: space.xl, paddingTop: space.sm },
  add: { gap: space.sm, alignItems: 'flex-start' },
});
