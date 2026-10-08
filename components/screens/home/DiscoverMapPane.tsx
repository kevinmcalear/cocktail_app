import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Caption, Chip, GlassButton, GlassSurface, Title, useDs } from '@/components/ds';
import { AreaRankList, EarlyList, ListNote } from '@/components/screens/rankings/RankingLists';
import { DrinkAtBarList, DrinkAtBarRow, type DrinkScores, type MoreDrinks } from '@/components/screens/home/DrinksAtBars';
import { layout, radius, space } from '@/constants/tokens';
import { useDebounced, useDiscoverRankings, useTopBars } from '@/hooks/useDiscover';
import { useDiscoverBars, useDiscoverList, useTileBars } from '@/hooks/useDiscoverDrinks';
import { useItemScores } from '@/hooks/useFlavor';
import { barPins, barScoresFor, byScore, closedPins, drinkCount, pickFilter, scorePins, type DiscoverBar, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';
import { areaFromViewport, cameraFor, cameraForArea, pinsFrom, type Camera, type Viewport } from '@/lib/discoverMap';
import { areaLabel, areaParams, earlyNote, peopleCount, type Area } from '@/lib/nearMe';
import { MIN_RANKERS, plural } from '@/lib/ranking';

import { DiscoverMap } from './DiscoverMap';
import { MapCredit } from './MapCredit';
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
  results: { drinks: DiscoverDrink[]; more: MoreDrinks; barsById: ReadonlyMap<string, DiscoverBar>; isLoading: boolean; title: string; closed?: DiscoverBar[] };
  /** What the map shows once the person has moved it (null after a refit), so search can stay in view. */
  onViewport?: (viewport: Viewport | null) => void;
  /** sheet: phones, the list in a bottom sheet over the map. side: wide screens, the list is beside it. */
  mode: 'sheet' | 'side';
  /** Controls over the top of the map (phones: search, where, filters, and back to the list). */
  top?: ReactNode;
  /** Room for the tab bar: the phone sheet floats above it rather than behind it. */
  bottomInset?: number;
}

/** Stand-ins for "nothing yet" that keep the same identity between renders, so the pins aren't rebuilt. */
const NO_DRINKS: DiscoverDrink[] = [];
const NO_ROWS: never[] = [];
const NO_SCORES: Readonly<Record<string, number>> = {};
const drinkKey = (d: DiscoverDrink) => d.id;
/** How long after the drinks land before the other layers load behind them. */
const PREFETCH_AFTER_MS = 2000;

/** Collapsed phone sheet: the grabber and the results title, so the map stays usable. */
const SHEET_PEEK = layout.minTapTarget + space.sm;

/**
 * Discover on a map: pins for the bars with matching drinks, for the drink's
 * best ("Best Martini": every martini, with the scores people gave it and its
 * bar, unscored ones plain), or the top bars (the score on each; early bars
 * as plain dots). Tap one to see it, and "Search this area" once the person
 * has moved the map. The camera fits the results whenever the
 * area, drink or layer changes, but never after "Search this area", so the
 * view the person chose stays put.
 */
export function DiscoverMapPane({ area, onArea, drink, filter, results, onViewport, mode, top, bottomInset = 0 }: DiscoverMapPaneProps) {
  const ds = useDs();
  const sheetRef = useRef<BottomSheet>(null);
  const [layer, setLayer] = useState<'drinks' | 'best' | 'bars'>('drinks');
  const byDrinks = layer === 'drinks';
  const byDrink = layer === 'best' && !!drink;
  // The other layers load a moment after the drinks are in (not while the map is still drawing),
  // so switching to one is instant.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (results.isLoading || warm) return;
    const t = setTimeout(() => setWarm(true), PREFETCH_AFTER_MS);
    return () => clearTimeout(t);
  }, [results.isLoading, warm]);
  const drinkRows = useDiscoverRankings(drink?.id, area, byDrink || warm);
  const barRows = useTopBars(area, layer === 'bars' || warm);
  // Pins on the drinks layer: the area's bars with matching drinks first, then, once the person
  // moves the map, the bars in view a tile at a time (anywhere already has every bar).
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const settled = useDebounced(viewport, 350);
  // The view last searched: it stays the view (its pins stay up), but isn't offered again.
  const [searched, setSearched] = useState<Viewport | null>(null);
  const areaBars = useDiscoverBars(area, filter, byDrinks);
  const tileBars = useTileBars(area.kind === 'anywhere' ? null : settled, filter, byDrinks);
  // "Best Martini": every martini here, scored where people have ranked it, best first.
  const pickedList = useDiscoverList(drink ? pickFilter(filter, drink.name) : filter, { enabled: !!drink && (byDrink || warm), pageSize: 300 });
  const picked = byDrink ? pickedList.drinks : NO_DRINKS;
  const rows = byDrinks
    ? { data: undefined, isLoading: results.isLoading || areaBars.isPending }
    : byDrink
      ? { data: undefined, isLoading: pickedList.isLoading }
      : barRows;
  const drinkScores = useItemScores(drink ? pickedList.drinks.map((d) => d.id) : NO_ROWS).data ?? NO_SCORES;
  const scores: DrinkScores | undefined = byDrink ? { drinks: drinkScores, bars: barScoresFor(picked, drinkScores, drinkRows.data?.ranked ?? NO_ROWS) } : undefined;
  const drinks = scores ? byScore(picked, scores.drinks) : results.drinks;
  const pins = [
    ...(byDrinks ? barPins([...(areaBars.data ?? []), ...tileBars.bars]) : scores ? scorePins(drinks, results.barsById, scores.bars) : pinsFrom(rows.data)),
    ...closedPins(results.closed ?? []),
  ];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pins.find((p) => p.id === selectedId) ?? null;
  // A tapped bar's own drinks, from the server on the drinks layer (its pin may be outside the area).
  const atBar = useDiscoverList({ ...filter, area }, { barId: selected?.id, enabled: !!selected && byDrinks && !selected.closed, pageSize: 100 });

  // Refit when what's shown changes, not when the person searched the view they're on.
  // While pins load, go to the area itself (near me at once), then fit the pins once they're in.
  const fitKey = area.kind === 'point' && area.source === 'map' ? null : JSON.stringify([areaParams(area), layer, byDrink ? drink.id : null, results.title, rows.isLoading]);
  const [fit, setFit] = useState<{ key: string; camera: Camera | null } | null>(null);
  if (fitKey !== null && fit?.key !== fitKey) {
    setFit({ key: fitKey, camera: (rows.isLoading ? null : cameraFor(pins)) ?? cameraForArea(area) ?? fit?.camera ?? null });
    setViewport(null);
  }
  // The maps report only the person's own moves, so any settled move since
  // the last fit or search is worth offering.
  const offer = viewport && settled === viewport && viewport !== searched ? viewport : null;
  useEffect(() => onViewport?.(settled), [settled, onViewport]);
  const searchArea = (v: Viewport) => {
    setSearched(v);
    setSelectedId(null);
    onArea(areaFromViewport(v));
  };

  const title = byDrinks ? results.title : `${byDrink ? `Best ${drink.name}` : 'Top bars'} ${areaLabel(area)}`;
  const layers = (
    <View role="radiogroup" accessibilityLabel="Show on the map" style={styles.chips}>
      <Chip label="Drinks" selected={byDrinks} onPress={() => setLayer('drinks')} />
      {drink ? <Chip label={`Best ${drink.name}`} selected={byDrink} onPress={() => setLayer('best')} /> : null}
      <Chip label="Top bars" selected={layer === 'bars'} onPress={() => setLayer('bars')} />
    </View>
  );
  const searchHere = offer ? (
    <View style={styles.center}>
      <GlassButton accessibilityLabel="Search this area" label="Search this area" icon="magnifyingglass" onPress={() => searchArea(offer)} />
    </View>
  ) : null;

  const ranked = rows.data?.ranked ?? [];
  const early = rows.data?.early ?? [];
  const drinkLayer = byDrinks || byDrink;
  // A tapped bar narrows the drinks to its own.
  const barDrinks = selected ? (byDrinks ? atBar.drinks : drinks.filter((d) => d.barId === selected.id)) : drinks;
  const more: MoreDrinks | undefined = selected ? undefined : byDrinks ? results.more : undefined;
  const loadingBar = !!selected && byDrinks && atBar.isLoading;
  // The phone sheet's rows; anything else (loading, a note, the ranked lists) shows as its empty state.
  const sheetDrinks = drinkLayer && !rows.isLoading && !loadingBar ? barDrinks : NO_DRINKS;
  const list = rows.isLoading || loadingBar ? (
    <ListNote>Loading…</ListNote>
  ) : drinkLayer ? (
    // Wide screens list a selected bar's drinks in its card; phones preview them there and list them all here.
    selected && mode === 'side' ? null : barDrinks.length ? (
      <DrinkAtBarList key={selectedId ?? 'all'} drinks={barDrinks} limit={20} scores={scores} more={more} />
    ) : (
      <ListNote>{`No ${byDrink ? plural(drink.name) : 'drinks'} ${areaLabel(area)} match. Move the map and search this area, or pick another style.`}</ListNote>
    )
  ) : ranked.length ? (
    <AreaRankList rows={ranked} scoreDetail={(r) => peopleCount(r.rankers)} />
  ) : early.length ? (
    <>
      <ListNote>{earlyNote(early, MIN_RANKERS)}</ListNote>
      <EarlyList rows={early} />
    </>
  ) : (
    <ListNote>{`Nobody has ranked a drink at a bar ${areaLabel(area)} yet. Move the map and search this area.`}</ListNote>
  );

  const map = (
    <DiscoverMap
      pins={pins}
      selectedId={selectedId}
      // On phones a tapped bar lowers the sheet, so its card (and drinks) sit over the map, not behind the list.
      onSelect={(id) => {
        setSelectedId(id);
        if (id && mode === 'sheet') sheetRef.current?.snapToIndex(0);
      }}
      onViewportChange={setViewport}
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
          <GlassSurface style={styles.glassRow}>{layers}</GlassSurface>
          {searchHere}
        </View>
        {selected ? (
          <View pointerEvents="box-none" style={[styles.overlay, styles.overlayBottom]}>
            <SelectedBar key={selected.id} pin={selected} drinks={drinkLayer ? barDrinks : []} scores={scores} onClose={() => setSelectedId(null)} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {map}
      <View pointerEvents="box-none" style={[styles.overlay, styles.overlayTop]}>
        {top}
        {searchHere}
      </View>
      {selected ? (
        // Floats over the map just above the peek, so the map and the card share the screen.
        <View pointerEvents="box-none" style={[styles.overlay, { bottom: bottomInset + SHEET_PEEK + space.sm }]}>
          <SelectedBar
            key={selected.id}
            pin={selected}
            drinks={drinkLayer ? barDrinks : []}
            scores={scores}
            onClose={() => setSelectedId(null)}
            onShowAll={() => sheetRef.current?.snapToIndex(2)}
          />
        </View>
      ) : null}
      {/* The sheet lives in a box that ends above the tab bar, so nothing of it shows behind the bar. */}
      <View pointerEvents="box-none" style={[styles.sheetBox, { bottom: bottomInset }]}>
        <BottomSheet
          ref={sheetRef}
          snapPoints={[SHEET_PEEK, '50%', '88%']}
          backgroundStyle={{ backgroundColor: ds.c.surface, borderRadius: radius.sheet }}
          handleIndicatorStyle={{ backgroundColor: ds.c.lineStrong }}
          accessibilityLabel="Results"
        >
          {/* A virtualized list: "anywhere" can load hundreds of drinks, and only the ones on screen are drawn. */}
          <BottomSheetFlatList
            data={sheetDrinks}
            keyExtractor={drinkKey}
            renderItem={({ item }: { item: DiscoverDrink }) => <DrinkAtBarRow drink={item} scores={scores} />}
            extraData={scores}
            contentContainerStyle={styles.sheet}
            ListHeaderComponent={
              <View style={styles.sheetHead}>
                {/* The peek line opens the sheet too, for anyone who taps rather than swipes. */}
                <Pressable role="button" accessibilityLabel="Show the list" onPress={() => sheetRef.current?.snapToIndex(1)}>
                  <Caption tone="muted" numberOfLines={1}>
                    {rows.isLoading
                      ? 'Loading…'
                      : selected?.closed
                        ? `${selected.name}: ${selected.closed.toLowerCase()}, kept for its history`
                        : selected && drinkLayer
                          ? `${drinkCount(byDrinks ? (atBar.totals?.drinks ?? barDrinks.length) : barDrinks.length)} at ${selected.name} · tap or swipe up for them`
                          : `${pins.length} ${pins.length === 1 ? 'bar' : 'bars'} in view · tap or swipe up for the list`}
                  </Caption>
                </Pressable>
                <Title role="heading" numberOfLines={1}>
                  {title}
                </Title>
                {layers}
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
  flex: { flex: 1, minWidth: 0 },
  overlay: { position: 'absolute', left: space.lg, right: space.lg, gap: space.sm },
  overlayTop: { top: space.lg },
  // Clear of the map's attribution line.
  overlayBottom: { bottom: space.xxxl, maxWidth: 420 },
  center: { alignItems: 'center' },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  glassRow: { alignSelf: 'flex-start', padding: space.xs },
  sheet: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  sheetHead: { gap: space.md, paddingBottom: space.md },
  sheetEmpty: { gap: space.md },
  sheetFoot: { gap: space.md, paddingTop: space.md },
  // Floats above the tab bar, clear of the screen edges, like the tab bar itself.
  sheetBox: { position: 'absolute', top: 0, left: space.sm, right: space.sm, overflow: 'hidden', borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet },
});
