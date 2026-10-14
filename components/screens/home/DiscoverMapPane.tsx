import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassSurface, useDs } from '@/components/ds';
import { AreaRankList, EarlyList, ListNote } from '@/components/screens/rankings/RankingLists';
import { AlsoMentions, DrinkAtBarList, DrinkAtBarRow, type MoreDrinks } from '@/components/screens/home/DrinksAtBars';
import { radius, space } from '@/constants/tokens';
import { useBestDrink, useRowScores } from '@/hooks/useBestDrink';
import { useTopBars } from '@/hooks/useDiscover';
import { useDiscoverBars, useDiscoverList, useTileBars } from '@/hooks/useDiscoverDrinks';
import { useMapMoves } from '@/hooks/useMapMoves';
import { barPins, byScore, closedPins, scorePins, venueScores, withBarOrder, withBarScores, type DiscoverBar, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';
import { areaFromViewport, cameraFor, cameraForArea, pinsFrom, type Camera, type MapPin, type Viewport } from '@/lib/discoverMap';
import { namePins, searchTitle } from '@/lib/discoverMatch';
import { areaLabel, areaParams, earlyNote, type Area } from '@/lib/nearMe';
import { MIN_RANKERS, plural } from '@/lib/ranking';

import { MapLayers, SearchHere, type MapLayer } from './DiscoverControls';
import { DiscoverMap } from './DiscoverMap';
import { MapCredit } from './MapCredit';
import { SHEET_HANDLE, useMapSheetChrome } from './mapSheetChrome';
import { ClassicLine, resultsCaption, ResultsHead } from './ResultsHead';
import { SelectedBar } from './SelectedBar';

interface DiscoverMapPaneProps {
  area: Area;
  onArea: (area: Area) => void;
  /** The drink picked on Discover, for "Best Martini" pins. */
  drink: { id: string; name: string } | null;
  /** Discover's search and filters; `area` is the area the list is about. */
  filter: DrinkFilter;
  /**
   * Drinks at bars matching Discover's search and filters, in the area: the
   * default layer, a page at a time (`more`). `barsById`: the area's bars.
   * Closed bars pin on every layer when given.
   */
  results: { drinks: DiscoverDrink[]; more: MoreDrinks; barsById: ReadonlyMap<string, DiscoverBar>; isLoading: boolean; title: string; closed?: DiscoverBar[]; totals?: { drinks: number; bars: number } | null };
  /** What the map shows once the person has moved it (null after a refit), so search can stay in view. */
  onViewport?: (viewport: Viewport | null) => void;
  /** sheet: phones, the list in a bottom sheet over the map. side: wide screens, the list is beside it. */
  mode: 'sheet' | 'side';
  /** Controls over the top of the map (phones: search, where, filters, and back to the list). */
  top?: ReactNode;
  /** Room for the screen header over the top of the map: the controls and the open sheet stay below it. */
  topInset?: number;
  /** Nearest (phones, searching): where distances count from, the person else the area's middle. */
  from?: { latitude: number; longitude: number } | null;
  /** Where the person is: the "You are here" dot, and how far a tapped bar is. */
  me?: { latitude: number; longitude: number } | null;
  /** Wide screens: the tapped pin and the layer are the screen's; the pin shows in its list rather than over the map, and searching, the sort chips sit in the list (disc-desk-search). */
  pick?: { id: string | null; onPick: (pin: MapPin | null) => void; layer?: MapLayer; onLayer: (layer: MapLayer) => void };
}

/** Stand-ins for "nothing yet" that keep the same identity between renders, so the pins aren't rebuilt. */
const NO_DRINKS: DiscoverDrink[] = [];
const drinkKey = (d: DiscoverDrink) => d.id;
/** How long after the drinks land before the other layers load behind them. */
const PREFETCH_AFTER_MS = 2000;

/** Collapsed phone sheet: the grabber, the count, the title and the chips (disc-map), until the head measures itself. */
const SHEET_PEEK = 136;

/**
 * Discover on a map: pins for the bars with matching drinks, for the drink's
 * best ("Best Martini": every martini, with the scores people gave it and its
 * bar, unscored ones plain), or the top bars (the score on each; early bars
 * as plain dots). Tap one to see it. Browsing, the results follow the map
 * once it settles somewhere new; searching (or anywhere), "Search this area"
 * asks. The camera fits the results whenever the area, drink or layer
 * changes, but never after a search of the map, so the person's view stays put.
 */
export function DiscoverMapPane({ area, onArea, drink: given, filter, results, onViewport, mode, top, topInset = 0, from = null, me = null, pick }: DiscoverMapPaneProps) {
  const ds = useDs();
  const sheetRef = useRef<BottomSheet>(null);
  const chrome = useMapSheetChrome();
  // Searching, the layers read as a sort of what was found, pins name the best drinks, and a tapped bar leads with its best match (as filtering does).
  const searching = !!filter.search.trim();
  // Wide browsing shows Drinks | Top bars (disc-desk-browse); a drink's best once a style is picked.
  const drink = mode === 'side' && !searching && !filter.kinds.length ? null : given;
  const [own, setOwn] = useState<MapLayer>('drinks');
  const chosen = pick?.layer ?? own;
  const setLayer = (next: MapLayer) => {
    setOwn(next);
    pick?.onLayer(next);
  };
  const canNear = searching && !!from;
  const [peek, setPeek] = useState(SHEET_PEEK);
  const layer = (chosen === 'nearest' && !canNear) || (chosen === 'best' && !drink) ? 'drinks' : chosen;
  const nearest = layer === 'nearest';
  const byDrinks = layer === 'drinks' || nearest;
  const byDrink = layer === 'best' && !!drink;
  // The other layers load a moment after the drinks are in (not while the map draws), so switching is instant.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (results.isLoading || warm) return;
    const t = setTimeout(() => setWarm(true), PREFETCH_AFTER_MS);
    return () => clearTimeout(t);
  }, [results.isLoading, warm]);
  const barRows = useTopBars(area, layer === 'bars' || byDrinks || warm);
  const [fit, setFit] = useState<{ key: string; camera: Camera | null } | null>(null);
  // Browsing, the list follows the map (a tapped bar stays open); a search, or anywhere, waits for "Search this area".
  const follow = !searching && area.kind !== 'anywhere';
  const moves = useMapMoves(fit?.camera ?? null, follow, (v: Viewport) => onArea(areaFromViewport(v)));
  // Drinks layer pins: the area's bars with matches, then the bars in view a tile at a time once the map moves.
  const areaBars = useDiscoverBars(area, filter, byDrinks);
  const tileBars = useTileBars(area.kind === 'anywhere' ? null : moves.settled, filter, byDrinks);
  // "Best Martini": every martini here, scored where people have ranked it, best first.
  const { picked, scores, isLoading: pickedLoading } = useBestDrink(drink, filter, { load: byDrink || warm, active: byDrink });
  // Nearest: the same matches, closest first.
  const near = useDiscoverList(filter, { from, enabled: nearest });
  const rows = byDrinks
    ? { data: undefined, isLoading: (nearest ? near.isLoading : results.isLoading) || areaBars.isPending }
    : byDrink
      ? { data: undefined, isLoading: pickedLoading }
      : barRows;
  const drinks = scores ? byScore(picked, scores.drinks) : nearest ? near.drinks : results.drinks;
  const pins = [
    // The drinks layer's pins carry their bar's score too (b02), and its place on Top bars (which pins to draw).
    ...(byDrinks ? withBarOrder(withBarScores(barPins([...(areaBars.data ?? []), ...tileBars.bars]), venueScores(barRows.data?.ranked ?? [])), barRows.data?.early ?? []) : scores ? scorePins(drinks, results.barsById, scores.bars) : pinsFrom(rows.data)),
    ...closedPins(results.closed ?? []),
  ];
  const [ownId, setOwnId] = useState<string | null>(null);
  const selectedId = pick ? pick.id : ownId;
  const setSelectedId = (id: string | null) => (pick ? pick.onPick(pins.find((p) => p.id === id) ?? null) : setOwnId(id));
  const selected = pins.find((p) => p.id === selectedId) ?? null;
  // A tapped bar's own drinks, from the server on the drinks layer (its pin may be outside the area).
  const atBar = useDiscoverList({ ...filter, area }, { barId: selected?.id, enabled: !!selected && byDrinks && !selected.closed, pageSize: 100 });

  // Refit when what's shown changes, not after "Search this area"; near me stays on the person.
  const nearMe = area.kind === 'point' && area.source === 'me';
  const fitting = rows.isLoading || (byDrinks && areaBars.isPlaceholderData);
  const fitKey = area.kind === 'point' && area.source === 'map' ? null : JSON.stringify([areaParams(area), layer, byDrink ? drink.id : null, results.title, !nearMe && fitting]);
  if (fitKey !== null && fit?.key !== fitKey) {
    setFit({ key: fitKey, camera: (fitting || nearMe ? null : cameraFor(byDrinks ? barPins(areaBars.data ?? []) : pins)) ?? cameraForArea(area) ?? fit?.camera ?? null });
    moves.reset();
  }
  useEffect(() => onViewport?.(moves.settled), [moves.settled, onViewport]);

  const title = byDrinks ? (searching ? searchTitle(filter.search) : results.title) : `${byDrink ? `Best ${drink.name}` : 'Top bars'} ${areaLabel(area)}`;
  const layers = <MapLayers layer={layer} onLayer={setLayer} drinkName={drink?.name ?? null} searching={searching} nearest={canNear} />;
  const searchHere = moves.offer ? <SearchHere onPress={() => moves.offer && moves.search(moves.offer)} /> : null;

  const ranked = rows.data?.ranked ?? [];
  const early = rows.data?.early ?? [];
  const drinkLayer = byDrinks || byDrink;
  const lead = drinkLayer && (searching || filter.kinds.length > 0);
  // A tapped bar narrows the drinks to its own.
  const barDrinks = selected ? (byDrinks ? atBar.drinks : drinks.filter((d) => d.barId === selected.id)) : drinks;
  // The drinks layer's rows carry scores too (b02): each drink's own and its bar's under it.
  const browse = useRowScores(barDrinks, area, byDrinks);
  const shown = scores ?? (byDrinks ? browse : undefined);
  const more: MoreDrinks | undefined = selected || !byDrinks ? undefined : nearest ? { total: near.totals?.drinks ?? null, hasMore: near.hasMore, loadMore: near.loadMore, loading: near.isLoadingMore } : results.more;
  const loadingBar = !!selected && byDrinks && atBar.isLoading;
  // The phone sheet's rows; anything else (loading, a note, the ranked lists) shows as its empty state.
  const sheetDrinks = drinkLayer && !rows.isLoading && !loadingBar ? (selected && lead ? barDrinks.slice(1) : barDrinks) : NO_DRINKS;
  const list = rows.isLoading || loadingBar ? (
    <ListNote>Loading…</ListNote>
  ) : drinkLayer ? (
    // Wide screens list a selected bar's drinks in its card; the phone sheet's list has them (its first in the head).
    selected && (mode === 'side' || barDrinks.length > 0) ? null : barDrinks.length ? (
      <DrinkAtBarList key={selectedId ?? 'all'} drinks={barDrinks} limit={20} scores={shown} more={more} />
    ) : (
      <ListNote>{`No ${byDrink ? plural(drink.name) : 'drinks'} ${areaLabel(area)} match. Move the map${follow ? '' : ' and search this area'}, or pick another style.`}</ListNote>
    )
  ) : ranked.length ? (
    <AreaRankList rows={ranked} scoreDetail={(r) => `${r.rankers} ranked`} love />
  ) : early.length ? (
    <>
      <ListNote>{earlyNote(early, MIN_RANKERS)}</ListNote>
      <EarlyList rows={early} love />
    </>
  ) : (
    <ListNote>{`Nobody has ranked a drink at a bar ${areaLabel(area)} yet. Move the map${follow ? '' : ' and search this area'}.`}</ListNote>
  );

  const map = (
    <DiscoverMap
      pins={searching && byDrinks ? namePins(pins, results.drinks, selectedId) : pins}
      me={me}
      selectedId={selectedId}
      // On phones a tapped bar opens the sheet halfway on it: its matching drink, then the bar.
      onSelect={(id) => {
        setSelectedId(id);
        if (id && mode === 'sheet') sheetRef.current?.snapToIndex(1);
      }}
      onViewportChange={moves.onMove}
      camera={fit?.camera ?? null}
      scheme={ds.scheme}
      accent={ds.accentFill}
      compact={mode === 'sheet'}
    />
  );

  if (mode === 'side') {
    return (
      <View style={styles.fill}>
        {map}
        <View pointerEvents="box-none" style={[styles.overlay, styles.overlayTop]}>
          {searching && pick ? null : <GlassSurface style={styles.glassRow}><MapLayers layer={layer} onLayer={setLayer} drinkName={drink?.name ?? null} searching={searching} nearest={canNear} onGlass /></GlassSurface>}
          {searchHere}
        </View>
        {selected && !pick ? (
          <View pointerEvents="box-none" style={[styles.overlay, styles.overlayBottom]}>
            <SelectedBar key={selected.id} pin={selected} drinks={drinkLayer ? barDrinks : []} scores={shown} query={filter.search} area={area} lead={lead} me={me} onClose={() => setSelectedId(null)} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {map}
      <View pointerEvents="box-none" style={[styles.overlay, { top: topInset + space.lg }]}>
        {top}
        {searchHere}
      </View>
      {/* The sheet lives in a box that ends above the tab bar, so nothing of it shows behind the bar. */}
      <View pointerEvents="box-none" style={[styles.sheetBox, chrome.box, { top: topInset }]}>
        <BottomSheet ref={sheetRef} snapPoints={[peek, '50%', '88%']} {...chrome.sheet} accessibilityLabel="Results">
          {/* A virtualized list: "anywhere" can load hundreds of drinks, and only the ones on screen are drawn. */}
          <BottomSheetFlatList
            data={sheetDrinks}
            keyExtractor={drinkKey}
            renderItem={({ item, index }: { item: DiscoverDrink; index: number }) => (
              <>
                {searching ? <AlsoMentions drinks={sheetDrinks} index={index} search={filter.search} /> : null}
                <DrinkAtBarRow drink={item} scores={shown} query={filter.search} atBar={!!selected} />
              </>
            )}
            extraData={shown}
            contentContainerStyle={styles.sheet}
            ListHeaderComponent={
              <View style={styles.sheetHead}>
                {selected && !selected.closed ? (
                  <SelectedBar key={selected.id} variant="sheet" pin={selected} drinks={drinkLayer ? barDrinks : []} scores={shown} query={filter.search} area={area} lead={lead} me={me} total={results.more.total ?? results.drinks.length} onClose={() => setSelectedId(null)} />
                ) : (
                  <ResultsHead
                    caption={
                      rows.isLoading
                        ? 'Loading…'
                        : selected?.closed
                          ? `${selected.name}: ${selected.closed.toLowerCase()}, kept for its history`
                          : resultsCaption(searching && byDrinks, results.totals, areaLabel(area), pins.length)
                    }
                    title={title}
                    chips={layers}
                    below={searching && byDrinks ? <ClassicLine drinks={results.drinks} search={filter.search} where={areaLabel(area)} /> : null}
                    onOpen={() => sheetRef.current?.snapToIndex(1)}
                    onLayout={(e) => setPeek(Math.max(SHEET_PEEK, Math.ceil(e.nativeEvent.layout.height) + SHEET_HANDLE + space.sm))}
                  />
                )}
              </View>
            }
            // In a View: the list measures its empty state, and some of these are fragments.
            ListEmptyComponent={list ? <View style={styles.sheetEmpty}>{list}</View> : undefined}
            ListFooterComponent={
              <View style={styles.sheetFoot}>
                {more?.loading && sheetDrinks.length ? <ListNote>Loading more…</ListNote> : null}
                <MapCredit />
              </View>
            }
            // The next page as the list nears its end ("load more as you scroll").
            onEndReached={more?.hasMore ? more.loadMore : undefined}
            onEndReachedThreshold={1.5}
            // The sheet shows three to six rows; draw a few more, then the rest as it scrolls.
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
          />
        </BottomSheet>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: 'absolute', left: space.lg, right: space.lg, gap: space.sm },
  overlayTop: { top: space.lg },
  // Clear of the map's attribution line.
  overlayBottom: { bottom: space.xxxl, maxWidth: 420 },
  glassRow: { alignSelf: 'flex-start', padding: space.xs, borderRadius: radius.pill },
  sheet: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  sheetHead: { gap: space.sm, paddingBottom: space.sm },
  sheetEmpty: { gap: space.md },
  sheetFoot: { gap: space.md, paddingTop: space.md },
  // Sits on the tab bar, as wide as it (mapSheetChrome).
  sheetBox: { position: 'absolute', overflow: 'hidden' },
});
