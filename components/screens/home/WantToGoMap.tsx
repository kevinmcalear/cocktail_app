import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, Display, DsText, GlassSurface, PressableScale, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useWantToGo } from '@/hooks/useWantToGo';
import { nearestFirst, wantCamera, wantPins, type WantBar } from '@/lib/collectionStages';
import { useLastPlace } from '@/store/useLastPlace';

import { WantRow } from './CollectionBarRows';
import { DiscoverMap, mapAvailable } from './DiscoverMap';
import { MapCredit } from './MapCredit';
import { useMapSheetChrome } from './mapSheetChrome';
import { SelectedBar } from './SelectedBar';

/** Collapsed phone sheet: the grabber, the count and the title. */
const SHEET_PEEK = 120;
const barKey = (b: WantBar) => b.id;
const noMove = () => {};

/**
 * Collection > Bars > See them on the map (board home-collection-bars, step 3):
 * Discover's map with only your Want to go bars, nearest first, so you can see
 * where they are and pick one for tonight. It opens on the ones near you (all
 * of them when none are); pins carry everyone's score and a tapped one shows
 * Discover's bar card. Phones: the map full screen with the rows in a sheet;
 * wide screens: the rows beside it, as Discover lays out. Back goes to Collection.
 */
export function WantToGoMap() {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  const third = Math.min(640, Math.max(428, Math.round(useWindowDimensions().width / 3)));
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const chrome = useMapSheetChrome();
  const sheetRef = useRef<BottomSheet>(null);
  const { want, isLoading, error } = useWantToGo();
  const place = useLastPlace((s) => s.place);
  const me = place ? { latitude: place.latitude, longitude: place.longitude } : null;
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pillHeight, setPillHeight] = useState<number>(layout.minTapTarget);
  const rows = nearestFirst(want);
  const pins = wantPins(rows);
  const picked = pins.find((p) => p.id === pickedId) ?? null;
  const split = breakpoint !== 'phone';
  const open = rows.filter((b) => b.hours?.open).length;
  const count = `${rows.length} ${rows.length === 1 ? 'bar' : 'bars'}`;
  const caption = [count, open ? `${open} open now` : null].filter(Boolean).join(' · ');
  // Back to Collection, leaving Discover as everyone else sees it.
  const back = () => {
    router.setParams({ list: undefined });
    router.navigate('/collection');
  };
  const onSelect = (id: string | null) => {
    setPickedId(id);
    if (id && !split) sheetRef.current?.snapToIndex(1);
  };

  const status = error ? 'Couldn’t load your bars. Try again in a moment.' : !isLoading && !rows.length ? 'Tap the heart on a bar’s page to keep it here until you go.' : null;
  const map =
    mapAvailable && !isLoading ? (
      <WantMap pins={pins} camera={wantCamera(rows)} me={me} selectedId={pickedId} onSelect={onSelect} compact={!split} />
    ) : null;
  const list = rows.map((b) => (
    <View role="listitem" key={b.id}>
      <WantRow bar={b} compact />
    </View>
  ));

  if (split) {
    return (
      <View style={[styles.screen, styles.row, { backgroundColor: ds.c.ground }]}>
        <ScrollView style={{ width: breakpoint === 'desktop' ? third : 420, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: insets.top + space.lg, paddingBottom: bottom }}>
          <PressableScale role="link" accessibilityLabel="Back to Collection" onPress={back} style={styles.backLink} hitSlop={4}>
            <IconSymbol name="chevron.left" size={16} color={ds.accentText} />
            <DsText variant="body" color={ds.accentText}>
              Collection
            </DsText>
          </PressableScale>
          <Display aria-level={1}>Want to go</Display>
          <Caption tone="muted" style={styles.caption}>
            {rows.length ? `${caption} · nearest first` : null}
          </Caption>
          {picked ? <SelectedBar key={picked.id} pin={picked} drinks={[]} me={me} onClose={() => setPickedId(null)} /> : null}
          {status ? <Body tone="muted">{status}</Body> : <View role="list">{list}</View>}
        </ScrollView>
        <View style={[styles.flex, styles.mapSide, { borderLeftColor: ds.c.line }]}>{map}</View>
      </View>
    );
  }

  const pillTop = insets.top + space.sm;
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {map}
      <View pointerEvents="box-none" style={[styles.pillBox, { top: pillTop, left: gutter, right: gutter }]} onLayout={(e) => setPillHeight(e.nativeEvent.layout.height)}>
        <GlassSurface style={styles.pill}>
          <PressableScale role="link" accessibilityLabel="Back to Collection" onPress={back} style={styles.backButton} hitSlop={4}>
            <IconSymbol name="chevron.left" size={20} color={ds.c.ink} />
          </PressableScale>
          <Body role="heading" aria-level={1} numberOfLines={1} style={styles.flex}>
            Want to go
          </Body>
          {rows.length ? (
            <Caption tone="muted" style={styles.pillCount}>
              {count}
            </Caption>
          ) : null}
        </GlassSurface>
      </View>
      {/* As on Discover: the sheet lives in a box that ends above the tab bar. */}
      <View pointerEvents="box-none" style={[styles.sheetBox, chrome.box, { top: pillTop + pillHeight + space.sm }]}>
        <BottomSheet ref={sheetRef} index={1} snapPoints={[SHEET_PEEK, '45%', '88%']} {...chrome.sheet} accessibilityLabel="Want to go">
          <BottomSheetFlatList
            data={picked ? [] : rows}
            keyExtractor={barKey}
            renderItem={({ item }: { item: WantBar }) => <WantRow bar={item} compact />}
            contentContainerStyle={styles.sheet}
            ListHeaderComponent={
              picked ? (
                <SelectedBar key={picked.id} variant="sheet" pin={picked} drinks={[]} me={me} back="Want to go" onClose={() => setPickedId(null)} />
              ) : (
                <View style={styles.sheetHead}>
                  {rows.length ? <Caption tone="muted">{`${caption} · swipe up for all`}</Caption> : null}
                  <Display>Want to go</Display>
                </View>
              )
            }
            ListEmptyComponent={status ? <Body tone="muted">{status}</Body> : undefined}
            ListFooterComponent={
              <View style={styles.sheetFoot}>
                <MapCredit />
              </View>
            }
          />
        </BottomSheet>
      </View>
    </View>
  );
}

/** The map, mounted once the bars are in, so it opens on them; after that it stays where the person moves it. */
function WantMap({ pins, camera, me, selectedId, onSelect, compact }: { pins: ReturnType<typeof wantPins>; camera: ReturnType<typeof wantCamera>; me: { latitude: number; longitude: number } | null; selectedId: string | null; onSelect: (id: string | null) => void; compact: boolean }) {
  const ds = useDs();
  const [start] = useState(camera);
  return <DiscoverMap pins={pins} me={me} selectedId={selectedId} onSelect={onSelect} onViewportChange={noMove} camera={start} scheme={ds.scheme} accent={ds.accentFill} compact={compact} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: 'row' },
  flex: { flex: 1, minWidth: 0 },
  mapSide: { borderLeftWidth: StyleSheet.hairlineWidth },
  backLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, minHeight: layout.minTapTarget },
  caption: { marginTop: space.xs, marginBottom: space.sm },
  pillBox: { position: 'absolute' },
  pill: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTapTarget + space.xs, borderRadius: radius.pill },
  backButton: { width: layout.minTapTarget + space.xs, height: layout.minTapTarget + space.xs, alignItems: 'center', justifyContent: 'center' },
  pillCount: { paddingRight: space.lg + 2 },
  sheetBox: { position: 'absolute', overflow: 'hidden' },
  sheet: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  sheetHead: { gap: space.xs, paddingBottom: space.sm },
  sheetFoot: { gap: space.md, paddingTop: space.md },
});
