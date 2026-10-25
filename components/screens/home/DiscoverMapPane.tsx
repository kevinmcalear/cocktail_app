import type BottomSheet from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDs } from '@/components/ds';
import { ListNote } from '@/components/screens/rankings/RankingLists';
import { AlsoMentions, DrinkAtBarRow, type MoreDrinks } from '@/components/screens/home/DrinksAtBars';
import { space } from '@/constants/tokens';
import { useBestDrink, useRowScores } from '@/hooks/useBestDrink';
import { useTopBars } from '@/hooks/useDiscover';
import { useDiscoverBars, useDiscoverList, useTileBars } from '@/hooks/useDiscoverDrinks';
import { useMapMoves } from '@/hooks/useMapMoves';
import { barPins, byScore, closedPins, scorePins, sheetCount, venueScores, withBarOrder, withBarScores, type DiscoverBar, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';
import { areaFromViewport, cameraFor, cameraForArea, type Camera, type MapPin, type Viewport } from '@/lib/discoverMap';
import { namePins, searchTitle } from '@/lib/discoverMatch';
import { areaLabel, areaParams, type Area } from '@/lib/nearMe';

import { SearchHere, type MapLayer } from './DiscoverControls';
import { DiscoverMap } from './DiscoverMap';
import { useFindMe } from './FindMe';
import { MapCredit } from './MapCredit';
import { MapSheet } from './MapSheet';
import { useMapSheetChrome } from './mapSheetChrome';
import { ClassicLine } from './ResultsHead';
import { SelectedBar } from './SelectedBar';
import { TopBarsList, useTopBarsCount } from './TopBars';

interface DiscoverMapPaneProps {
  area: Area;
  onArea: (area: Area) => void;
  /** The classic of the style picked, or the drink a search names: each bar's own score for it. */
  drink: { id: string; name: string } | null;
  /** Discover's search and filters; `area` is the area the list is about. */
  filter: DrinkFilter;
  /**
   * Drinks at bars matching Discover's search and filters, in the area: the
   * mixed list, a page at a time (`more`). `barsById`: the area's bars.
   * Closed bars pin on every order when given.
   */
  results: { drinks: DiscoverDrink[]; more: MoreDrinks; barsById: ReadonlyMap<string, DiscoverBar>; isLoading: boolean; title: string; closed?: DiscoverBar[]; totals?: { drinks: number; bars: number } | null; /** Browsing: only drinks on now, Nearest too. */ onNow?: boolean };
  /** How the drinks are ordered, from the options row (DiscoverOptions.tsx): mixed, a style's best, or nearest. */
  layer: MapLayer;
  /** What the map shows once the person has moved it (null after a refit), so search can stay in view. */
  onViewport?: (viewport: Viewport | null) => void;
  /** sheet: phones, the list in a bottom sheet over the map. side: wide screens, the list is beside it. */
  mode: 'sheet' | 'side';
  /** Over the top of the map, under the header (phones: the drink chips or the options, and a note on where). */
  top?: ReactNode;
  /** Room for the screen header over the top of the map: the controls and the risen sheet stay below it. */
  topInset?: number;
  /** Phones: the order again, under the sheet's title once the map is covered. */
  order?: ReactNode;
  /** Phones, nothing picked: the shelves at the top of the risen sheet (BrowseShelves). */
  browse?: ReactNode;
  /** Phones: Top bars' See all, listed in the sheet. */
  topBars?: boolean;
  /** Nearest: where distances count from, the person else the area's middle. */
  from?: { latitude: number; longitude: number } | null;
  /** Where the person is: the "You are here" dot, and how far a tapped bar is. */
  me?: { latitude: number; longitude: number } | null;
  /** The tapped pin is the screen's (wide screens: the pin shows in its list rather than over the map). Phones: the header's pill goes back from it. */
  pick?: { id: string | null; onPick: (pin: MapPin | null) => void };
  /** A bar the list is showing: its pin stays open, and the camera sits on it. */
  opened?: string | null;
  focus?: Camera | null;
  onShowBar?: (barId: string | null) => void;
  /** Find me: back to where the person is (Near me, FindMe.tsx). */
  onFindMe?: () => void;
}

const NO_DRINKS: DiscoverDrink[] = []; // "Nothing yet" with the same identity between renders, so the pins aren't rebuilt.
const PREFETCH_AFTER_MS = 2000; // How long after the drinks land before the other orders load behind them.
const SHEET_PEEK = 96; // The sheet at rest, until it measures itself.

/**
 * Discover on a map: pins for the bars with matching drinks, each with its
 * bar's score; with a style picked, each bar's best of it ("Martinis in this
 * area": every martini, best first, with the scores people gave them). Tap
 * one to see it. Browsing, the results follow the map once it settles
 * somewhere new; searching (or anywhere), "Search this area" asks. The camera
 * fits the results whenever the area, style or order changes, but never after
 * a search of the map, so the person's view stays put.
 */
export function DiscoverMapPane({ area, onArea, drink, filter, results, layer, onViewport, mode, top, topInset = 0, order, browse, topBars = false, from = null, me = null, pick, opened = null, focus = null, onShowBar, onFindMe }: DiscoverMapPaneProps) {
  const ds = useDs();
  const findMe = useFindMe(onFindMe);
  const sheetRef = useRef<BottomSheet>(null);
  const chrome = useMapSheetChrome();
  // Searching, pins name the best drinks, and a tapped bar leads with its best match (as filtering does).
  const searching = !!filter.search.trim();
  const picked = filter.kinds.length > 0;
  const [peek, setPeek] = useState(SHEET_PEEK);
  const nearest = layer === 'nearest' && !!from;
  // A style's best (or a search's Top rated, which needs the drink it names).
  const byDrink = layer === 'best' && (searching ? !!drink : picked);
  const byDrinks = !byDrink;
  // The other orders load a moment after the drinks are in (not while the map draws), so switching is instant.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (results.isLoading || warm) return;
    const t = setTimeout(() => setWarm(true), PREFETCH_AFTER_MS);
    return () => clearTimeout(t);
  }, [results.isLoading, warm]);
  const barRows = useTopBars(area);
  const [fit, setFit] = useState<{ key: string; camera: Camera | null } | null>(null);
  // Browsing, the list follows the map (a tapped bar stays open); a search, or anywhere, waits for "Search this area".
  const follow = !searching && area.kind !== 'anywhere';
  const moves = useMapMoves(fit?.camera ?? null, follow, (v: Viewport) => onArea(areaFromViewport(v)), focus);
  // Mixed and nearest pins: the area's bars with matches, then the bars in view a tile at a time once the map moves.
  const areaBars = useDiscoverBars(area, filter, byDrinks);
  const tileBars = useTileBars(area.kind === 'anywhere' ? null : moves.settled, filter, byDrinks);
  const { picked: best, scores, totals: bestTotals, isLoading: bestLoading } = useBestDrink(drink, filter, { load: byDrink || (warm && (searching ? !!drink : picked)), active: byDrink });
  const near = useDiscoverList(filter, { from, enabled: nearest, onNow: !searching && results.onNow });
  const loading = byDrink ? bestLoading : (nearest ? near.isLoading : results.isLoading) || areaBars.isPending;
  const drinks = scores ? byScore(best, scores.drinks) : nearest ? near.drinks : results.drinks;
  const pins = [
    // The bars' pins carry their score (b02), and their place on Top bars (which pins to draw); a style's best, each bar's best of it.
    ...(byDrinks ? withBarOrder(withBarScores(barPins([...(areaBars.data ?? []), ...tileBars.bars]), venueScores(barRows.data?.ranked ?? [])), barRows.data?.early ?? []) : scorePins(drinks, results.barsById, scores?.bars ?? {})),
    ...closedPins(results.closed ?? []),
  ];
  const [ownId, setOwnId] = useState<string | null>(null);
  // A tap is what narrows the list; a hovered row lights its pin while nothing is tapped.
  const sheetId = pick ? pick.id : ownId;
  const selectedId = sheetId ?? opened;
  const setSelectedId = (id: string | null) => (pick ? pick.onPick(pins.find((p) => p.id === id) ?? null) : setOwnId(id));
  const selected = pins.find((p) => p.id === sheetId) ?? null;
  // A tapped bar's own drinks, from the server when mixed (its pin may be outside the area).
  const atBar = useDiscoverList({ ...filter, area }, { barId: selected?.id, enabled: !!selected && byDrinks && !selected.closed, pageSize: 100 });

  // Refit when what's shown changes, not after "Search this area"; near me stays on the person, again on each fresh fix (opening, Find me).
  const nearMe = area.kind === 'point' && area.source === 'me';
  const fitting = loading || (byDrinks && areaBars.isPlaceholderData);
  const nearCamera = nearMe && !areaBars.isPlaceholderData ? cameraForArea(area, (areaBars.data ?? []).filter((b) => !b.closed), me) : null;
  const fitKey = area.kind === 'point' && area.source === 'map' ? null : JSON.stringify([areaParams(area), byDrink ? 'best' : 'drinks', results.title, nearMe ? [nearCamera?.zoom, findMe.again, me?.latitude, me?.longitude] : fitting]);
  if (fitKey !== null && fit?.key !== fitKey) {
    setFit({ key: fitKey, camera: (fitting || nearMe ? null : cameraFor(byDrinks ? barPins(areaBars.data ?? []) : pins)) ?? nearCamera ?? cameraForArea(area, [], me) ?? fit?.camera ?? null });
    moves.reset();
  }
  useEffect(() => onViewport?.(moves.settled), [moves.settled, onViewport]);

  const searchHere = moves.offer ? <SearchHere onPress={() => moves.offer && moves.search(moves.offer)} /> : null;
  const lead = searching || picked;
  // A tapped bar narrows the drinks to its own.
  const barDrinks = selected ? (byDrinks ? atBar.drinks : drinks.filter((d) => d.barId === selected.id)) : drinks;
  // The mixed rows carry scores too (b02): each drink's own and its bar's under it.
  const rowScores = useRowScores(barDrinks, area, byDrinks);
  const shown = scores ?? (byDrinks ? rowScores : undefined);
  const more: MoreDrinks | undefined = selected || byDrink ? undefined : nearest ? { total: near.totals?.drinks ?? null, hasMore: near.hasMore, loadMore: near.loadMore, loading: near.isLoadingMore } : results.more;
  const loadingBar = !!selected && byDrinks && atBar.isLoading;
  const where = areaLabel(area);
  const topBarsCount = useTopBarsCount(area);
  const empty = loading || loadingBar ? <ListNote>Loading…</ListNote> : <ListNote>{`No drinks ${where} match. Move the map${follow ? '' : ' and search this area'}, or pick another style.`}</ListNote>;

  const map = (
    <DiscoverMap
      pins={searching && byDrinks ? namePins(pins, results.drinks, selectedId) : pins}
      me={me}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onViewportChange={moves.onMove}
      camera={moves.camera}
      inset={mode === 'sheet' ? chrome.inset(topInset + space.lg, peek) : undefined}
      scheme={ds.scheme}
      accent={ds.accentFill}
      compact={mode === 'sheet'}
    />
  );

  if (mode === 'side') {
    return (
      <View style={styles.fill}>
        {map}
        {searchHere ? (
          <View pointerEvents="box-none" style={[styles.overlay, styles.overlayTop]}>
            {searchHere}
          </View>
        ) : null}
        {findMe.button('side')}
        {selected && !pick ? (
          <View pointerEvents="box-none" style={[styles.overlay, styles.overlayBottom]}>
            <SelectedBar key={selected.id} pin={selected} drinks={barDrinks} scores={shown} query={filter.search} area={area} lead={lead} me={me} onClose={() => setSelectedId(null)} />
          </View>
        ) : null}
      </View>
    );
  }

  // The sheet's rows; anything else (loading, a note, the top bars) shows as its empty state.
  const rows = topBars || loading || loadingBar ? NO_DRINKS : selected && lead ? barDrinks.slice(1) : barDrinks;
  const browsing = !topBars && !selected && !searching && !picked;
  const title = topBars ? `Top bars ${where}` : selected ? selected.name : searching ? searchTitle(filter.search) : results.title;
  const count = topBars
    ? topBarsCount
    : selected?.closed
      ? `${selected.closed}, kept for its history`
      : selected
        ? ''
        : sheetCount({ list: byDrink ? 'style' : searching ? 'search' : picked ? 'style' : 'browse', totals: byDrink ? bestTotals : nearest ? near.totals : results.totals, pins: pins.length });
  return (
    <View style={styles.fill}>
      {map}
      <View pointerEvents="box-none" style={[styles.overlay, { top: topInset + space.lg }]}>
        <View {...chrome.controls}>{top}</View>
        {searchHere}
      </View>
      <MapSheet
        sheetRef={sheetRef}
        animated={findMe.sheet}
        findMe={(full) => findMe.button('sheet', full)}
        topInset={topInset}
        onPeek={setPeek}
        title={title}
        count={count}
        below={
          topBars || selected ? null : (
            <>
              {order}
              {searching && byDrinks ? <ClassicLine drinks={results.drinks} search={filter.search} where={where} /> : null}
            </>
          )
        }
        bar={selected && !selected.closed ? { id: selected.id, card: <SelectedBar key={selected.id} variant="sheet" pin={selected} drinks={barDrinks} scores={shown} query={filter.search} area={area} lead={lead} me={me} onClose={() => setSelectedId(null)} /> } : null}
        browse={browsing ? browse : null}
        listTitle={browsing ? results.title.replace(/^Drinks/, 'All drinks') : undefined}
        drinks={rows}
        renderItem={(item, index) => (
          <>
            {searching ? <AlsoMentions drinks={rows} index={index} search={filter.search} /> : null}
            <DrinkAtBarRow drink={item} scores={shown} query={filter.search} atBar={!!selected} onShowBar={onShowBar} />
          </>
        )}
        extraData={shown}
        empty={topBars ? <TopBarsList area={area} onShowBar={onShowBar} /> : selected ? (loadingBar ? <ListNote>Loading…</ListNote> : null) : empty}
        footer={
          <>
            {more?.loading && rows.length ? <ListNote>Loading more…</ListNote> : null}
            <MapCredit />
          </>
        }
        onEndReached={more?.hasMore ? more.loadMore : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: 'absolute', left: space.lg, right: space.lg, gap: space.sm },
  overlayTop: { top: space.lg },
  // Clear of the map's attribution line.
  overlayBottom: { bottom: space.xxxl, maxWidth: 420 },
});
