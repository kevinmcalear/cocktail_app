import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, GlassButton, GlassSurface, Headline, Spec, Surface, Title, useDs } from '@/components/ds';
import { AreaRankList, EarlyList, ListNote } from '@/components/screens/rankings/RankingLists';
import { DiscoverKinds } from '@/components/screens/home/DiscoverKinds';
import { DrinkAtBarList } from '@/components/screens/home/DrinksAtBars';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { layout, space } from '@/constants/tokens';
import { useDebounced, useDiscoverRankings, useTopBars } from '@/hooks/useDiscover';
import { drinkCount, drinkPins, type DiscoverBar, type DiscoverDrink } from '@/lib/discoverDrinks';
import { areaFromViewport, cameraFor, cameraForArea, pinsFrom, type Camera, type MapPin, type Viewport } from '@/lib/discoverMap';
import { areaLabel, areaParams, earlyNote, peopleCount, type Area } from '@/lib/nearMe';
import { formatScore, MIN_RANKERS } from '@/lib/ranking';

import { DiscoverMap } from './DiscoverMap';
import { MapCredit } from './MapCredit';

interface DiscoverMapPaneProps {
  area: Area;
  onArea: (area: Area) => void;
  /** The drink picked on Discover, for "Best Martini" pins. */
  drink: { id: string; name: string } | null;
  /** Drinks at bars matching Discover's search and style, in the area: the default layer. */
  results: { drinks: DiscoverDrink[]; barsById: ReadonlyMap<string, DiscoverBar>; isLoading: boolean; title: string };
  /** The style or spirit picked; the phone sheet can change it. */
  kind: string | null;
  onKind: (kind: string | null) => void;
  /** sheet: phones, the list in a bottom sheet over the map. side: wide screens, the list is beside it. */
  mode: 'sheet' | 'side';
  /** Controls over the top of the map (phones: where, and back to the list). */
  top?: ReactNode;
  /** The floating tab bar's height: the sheet runs behind it, so its content is padded by this much. */
  bottomInset?: number;
}

/** The bar a pin stands for: its score (or early), and a way in. */
function SelectedBar({ pin, onClose }: { pin: MapPin; onClose: () => void }) {
  const router = useRouter();
  return (
    <Surface raised style={styles.card}>
      <View style={styles.cardRow} accessible accessibilityLabel={`${pin.name}, ${pin.place}. ${pin.score === null ? `Early: ${peopleCount(pin.rankers)} ranked` : `Score ${formatScore(pin.score)}, ${peopleCount(pin.rankers)}`}`}>
        <UserAvatar uri={pin.logo} name={pin.name} size={48} />
        <View style={styles.flex}>
          <Headline numberOfLines={1}>{pin.name}</Headline>
          <Caption tone="muted" numberOfLines={1}>
            {pin.place || 'Bar'}
          </Caption>
        </View>
        {pin.drinks ? (
          <Caption tone="muted">{drinkCount(pin.drinks)}</Caption>
        ) : pin.score === null ? (
          <Caption tone="muted">{pin.rankers ? `Early · ${peopleCount(pin.rankers)}` : 'Not ranked yet'}</Caption>
        ) : (
          <View style={styles.score}>
            <Spec>{formatScore(pin.score)}</Spec>
            <Caption tone="muted">{peopleCount(pin.rankers)}</Caption>
          </View>
        )}
      </View>
      <View style={styles.cardActions}>
        <Button label="Close" variant="ghost" onPress={onClose} />
        <Button label="Open bar" onPress={() => router.push(`/p/${pin.handle || pin.id}`)} />
      </View>
    </Surface>
  );
}

/**
 * Discover on a map: pins for the ranked bars (the score on each; early bars
 * as plain dots), tap one to see it, and "Search this area" once the person
 * has moved the map. The camera fits the results whenever the
 * area, drink or layer changes, but never after "Search this area", so the
 * view the person chose stays put.
 */
export function DiscoverMapPane({ area, onArea, drink, results, kind, onKind, mode, top, bottomInset = 0 }: DiscoverMapPaneProps) {
  const ds = useDs();
  const [layer, setLayer] = useState<'drinks' | 'best' | 'bars'>('drinks');
  const byDrinks = layer === 'drinks';
  const byDrink = layer === 'best' && !!drink;
  const drinkRows = useDiscoverRankings(byDrink ? drink.id : null, area);
  const barRows = useTopBars(area);
  const rows = byDrinks ? { data: undefined, isLoading: results.isLoading } : byDrink ? drinkRows : barRows;
  const pins = byDrinks ? drinkPins(results.drinks, results.barsById) : pinsFrom(rows.data);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pins.find((p) => p.id === selectedId) ?? null;

  // Refit when what's shown changes, not when the person searched the view they're on.
  const fitKey = area.kind === 'point' && area.source === 'map' ? null : JSON.stringify([areaParams(area), layer, byDrink ? drink.id : kind, results.title]);
  const [fit, setFit] = useState<{ key: string; camera: Camera | null } | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  if (fitKey !== null && fit?.key !== fitKey && !rows.isLoading) {
    setFit({ key: fitKey, camera: cameraFor(pins) ?? cameraForArea(area) });
    setViewport(null);
  }
  // The maps report only the person's own moves, so any settled move since
  // the last fit or search is worth offering.
  const settled = useDebounced(viewport, 350);
  const offer = viewport && settled === viewport ? viewport : null;  const searchArea = (v: Viewport) => {
    setViewport(null);
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
  // A tapped bar narrows the drinks to its own.
  const barDrinks = selected ? results.drinks.filter((d) => d.barId === selected.id) : results.drinks;
  const list = rows.isLoading ? (
    <ListNote>Loading…</ListNote>
  ) : byDrinks ? (
    barDrinks.length ? (
      <DrinkAtBarList key={selectedId ?? 'all'} drinks={barDrinks} barsById={results.barsById} limit={20} />
    ) : (
      <ListNote>{`No drinks ${areaLabel(area)} match. Move the map and search this area, or pick another style.`}</ListNote>
    )
  ) : ranked.length ? (
    <AreaRankList rows={ranked} scoreDetail={byDrink ? undefined : (r) => peopleCount(r.rankers)} />
  ) : early.length ? (
    <>
      <ListNote>{earlyNote(early, MIN_RANKERS)}</ListNote>
      <EarlyList rows={early} />
    </>
  ) : (
    <ListNote>{`Nobody has ranked ${byDrink ? `a ${drink.name}` : 'a drink'} at a bar ${areaLabel(area)} yet. Move the map and search this area.`}</ListNote>
  );

  const map = (
    <DiscoverMap
      pins={pins}
      selectedId={selectedId}
      onSelect={setSelectedId}
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
            <SelectedBar pin={selected} onClose={() => setSelectedId(null)} />
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
      <BottomSheet
        snapPoints={[layout.minTapTarget * 4 + bottomInset, '50%', '88%']}
        backgroundStyle={{ backgroundColor: ds.c.surface }}
        handleIndicatorStyle={{ backgroundColor: ds.c.lineStrong }}
        accessibilityLabel="Results"
      >
        <BottomSheetScrollView contentContainerStyle={[styles.sheet, { paddingBottom: bottomInset }]}>
          {selected ? <SelectedBar pin={selected} onClose={() => setSelectedId(null)} /> : null}
          <Title role="heading">{title}</Title>
          {layers}
          {byDrinks ? <DiscoverKinds kind={kind} onChange={onKind} /> : null}
          {list}
          <MapCredit />
        </BottomSheetScrollView>
      </BottomSheet>
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
  card: { gap: space.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  score: { alignItems: 'flex-end' },
  sheet: { paddingHorizontal: space.lg, gap: space.md },
});
