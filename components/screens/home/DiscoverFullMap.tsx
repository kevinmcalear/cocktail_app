import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, GlassButton, GlassSurface, PressableScale, Sheet, useDs, useGutter } from '@/components/ds';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { MapBar } from '@/hooks/useDiscoverHome';
import { areaFromViewport, cameraFor, cameraForArea, movedFrom, type Camera, type Viewport } from '@/lib/discoverMap';
import type { Area } from '@/lib/nearMe';

import { useBarPins } from './DiscoverParts';
import { DiscoverMap, mapAvailable } from './DiscoverMap';
import { useOverlayKeys } from './discoverOverlayParts';
import { MapCredit } from './MapCredit';
import { SelectedBar } from './SelectedBar';

type Point = { latitude: number; longitude: number } | null;

interface DiscoverFullMapProps {
  /** The area's bars, as the map card has them. */
  bars: readonly MapBar[];
  /** The bars the list names: their pins carry their names. */
  named: readonly string[];
  area: Area;
  me: Point;
  /** Where Discover is looking ("West Village"), on the pill. */
  title: string;
  /** "12 bars open near you", on the pill. */
  caption: string;
  /** Where the map was when this area was searched from it: it opens there again, not on the area's whole circle. */
  start?: Camera | null;
  /** Search this area: Discover moves there, its list too; `at` is the map's view then (`start` next time). */
  onArea: (area: Area, at: Camera) => void;
  /** Back to the list. */
  onClose: () => void;
}

/**
 * Discover's full map (the map card's Open the map, on phones): the map the
 * whole screen, each bar a pin in its own colours. A pin opens the bar's
 * sheet (its row opens the bar). Moving the map offers "Search this area",
 * which moves Discover there, list and all; the camera stays where the person
 * put it. The pill's back arrow, List, Android back and Escape go back to the
 * list. Lazy on the web (DiscoverFullMapLazy.web.tsx), off /discover's first load.
 */
export function DiscoverFullMap({ bars, named, area, me, title, caption, start = null, onArea, onClose }: DiscoverFullMapProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const pins = useBarPins(bars, named);
  // Opens where the card was looking (or where this area was searched); after that the person moves it, never a refit.
  const [camera] = useState<Camera | null>(() => start ?? cameraForArea(area, me) ?? cameraFor(pins));
  const [from, setFrom] = useState<Camera | null>(camera);
  const [view, setView] = useState<Viewport | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = pins.find((p) => p.id === pickedId) ?? null;
  const offer = view && movedFrom(from, view) ? view : null;

  const searchHere = () => {
    if (!offer) return;
    setFrom(offer);
    setView(null);
    setPickedId(null);
    onArea(areaFromViewport(offer), { latitude: offer.latitude, longitude: offer.longitude, zoom: offer.zoom });
  };
  // Android back and Escape: off the bar first, then back to the list.
  const back = useCallback(() => (pickedId ? setPickedId(null) : onClose()), [pickedId, onClose]);
  useOverlayKeys(back);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.raised }]}>
      {mapAvailable ? (
        <DiscoverMap pins={pins} me={me} selectedId={pickedId} onSelect={setPickedId} onViewportChange={setView} camera={camera} scheme={ds.scheme} accent={ds.accentFill} compact style={StyleSheet.absoluteFill} />
      ) : null}
      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + space.sm, left: gutter, right: gutter }]}>
        <GlassSurface style={styles.pill}>
          <PressableScale role="button" accessibilityLabel="Back to the list" onPress={onClose} style={styles.backButton} hitSlop={4}>
            <IconSymbol name="chevron.left" size={20} color={ds.c.ink} />
          </PressableScale>
          <Body role="heading" aria-level={1} numberOfLines={1} style={styles.flex}>
            {title}
          </Body>
          <Caption tone="muted" numberOfLines={1} style={styles.count}>
            {caption}
          </Caption>
        </GlassSurface>
        {offer ? (
          <View style={styles.center}>
            <GlassButton icon="magnifyingglass" label="Search this area" accessibilityLabel="Search this area" onPress={searchHere} />
          </View>
        ) : null}
      </View>
      <View pointerEvents="box-none" style={[styles.foot, { bottom: bottom + space.md, left: gutter, right: gutter }]}>
        <GlassButton icon="list.bullet" label="List" accessibilityLabel="Show the list" onPress={onClose} />
        <GlassSurface style={styles.credit}>
          <MapCredit />
        </GlassSurface>
      </View>
      <Sheet visible={!!picked} onClose={() => setPickedId(null)} accessibilityLabel={picked?.name ?? 'Bar'}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
          {picked ? <SelectedBar key={picked.id} variant="sheet" pin={picked} drinks={[]} area={area} me={me} onClose={() => setPickedId(null)} /> : null}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 },
  flex: { flex: 1, minWidth: 0 },
  top: { position: 'absolute', gap: space.sm },
  pill: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTapTarget + space.xs, borderRadius: radius.pill },
  backButton: { width: layout.minTapTarget + space.xs, height: layout.minTapTarget + space.xs, alignItems: 'center', justifyContent: 'center' },
  count: { paddingRight: space.lg, flexShrink: 1, maxWidth: '50%' },
  center: { alignItems: 'center' },
  foot: { position: 'absolute', alignItems: 'center', gap: space.sm },
  credit: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  // As other sheets pad theirs (Projects): room round the bar's card, and the home indicator's below it.
  sheet: { paddingHorizontal: space.xl, paddingTop: space.md },
});
