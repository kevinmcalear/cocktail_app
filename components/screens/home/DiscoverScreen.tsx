import { useNetInfo } from '@react-native-community/netinfo';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { GlassButton, PencilState, useBreakpoint, useDs } from '@/components/ds';
import { PopoverMenu, usePopover } from '@/components/ds/PopoverMenu';
import { usePageColumn } from '@/components/nav/Page';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { AreaNote } from '@/components/screens/home/DiscoverArea';
import { mapAvailable } from '@/components/screens/home/DiscoverMap';
import { BestNear, DeskChips, DiscoverLoading, DiscoverOffline, MapCard, NewMenus, PHONE_NAMES } from '@/components/screens/home/DiscoverParts';
import { placeSections } from '@/components/screens/home/DiscoverPlace';
import { TonightHead } from '@/components/screens/tonight/TonightParts';
import { LinkRow } from '@/components/techniques/LinkRow';
import { space } from '@/constants/tokens';
import { useBarCities } from '@/hooks/useDiscover';
import { useDiscoverArea } from '@/hooks/useDiscoverArea';
import { BEST_ROWS, useAreaBars, useBestNear, useNewMenus, useOpenClock } from '@/hooks/useDiscoverHome';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useLovedBars } from '@/hooks/useKept';
import { usePublishSearchArea } from '@/hooks/useSearchFrom';
import { useVenueFeature } from '@/hooks/useVenueFeatures';
import { mapCaption, placeName } from '@/lib/discoverHome';
import { STYLES } from '@/lib/drinkStyles';
import { areaLabel } from '@/lib/nearMe';

/** The desktop's list column (Prod-desk-discover: 470 wide, beside the map). */
const DESK_LIST = 470;
/** Discover lends search no style filters: a style search picks the list here. */
const NO_KINDS: readonly string[] = [];
/** Whether a style can lead the list: it needs a classic to rank (Low & no has none). */
const ranksFor = (id: string | undefined) => STYLES.some((s) => s.id === id && s.classics.length > 0);

/**
 * Discover, as drawn (Prod-discover, Prod-and-dark, Prod-desk-discover,
 * Sta-discover): where you are and what's open, the map of the bars near you,
 * the best of one style near you, ranked, and the new menus. Near me on an
 * iPhone's top row; Android's search bar sits on top instead. The desktop puts
 * the list beside a tall map, with Open now, two styles and Late as chips.
 * Search is the one search (the tab bar's field, Android's bar, ⌘K): Discover
 * lends it its place, so a search from here can look "This area". The boards
 * draw Near me on iPhones alone, so the place line opens the places menu on
 * every platform: Android and the desktop have no other way to Near me.
 */
export function DiscoverScreen() {
  const ds = useDs();
  const router = useRouter();
  const bottom = useTabBarInset();
  const wideWeb = useIsWideWeb();
  const breakpoint = useBreakpoint();
  const split = mapAvailable && breakpoint !== 'phone';
  const column = usePageColumn('text');
  const offline = useNetInfo().isConnected === false;
  // Online, this saves the bars you love to the phone, so offline Discover lists them (Sta-discover).
  useLovedBars();
  const { area, onArea, onCity, preferNear, near, onNearMe, locating, note } = useDiscoverArea();
  // Search's style chips open Discover on a style (/discover?kind=negroni).
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const [styleId, setStyleId] = useState(() => (ranksFor(kind) ? kind! : 'martini'));
  const [openOnly, setOpenOnly] = useState(true);
  const [late, setLate] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  const now = useOpenClock();
  const nearby = useAreaBars(area, locating, now);
  // Open now and Late are the desktop's chips; a bar whose hours nobody knows stays in.
  const shown = useMemo(() => nearby.bars.filter((b) => (!split || !openOnly || b.open !== false) && (!split || !late || b.late)), [nearby.bars, split, openOnly, late]);
  const best = useBestNear(area, styleId, !locating && !offline);
  // The chips filter every ranked row, then the list cuts it, so four show while four are open.
  const rows = useMemo(() => {
    if (!split) return best.rows;
    const shownIds = new Set(shown.map((b) => b.id));
    return best.rows.filter((r) => shownIds.has(r.barId) || !nearby.bars.some((b) => b.id === r.barId));
  }, [best.rows, nearby.bars, shown, split]);
  const menus = useNewMenus(split ? [] : nearby.bars, now);
  const limit = split ? BEST_ROWS.desk : BEST_ROWS.phone;
  const named = useMemo(() => rows.slice(0, limit).map((r) => r.barId), [rows, limit]);
  const me = useMemo(() => (near.status === 'ready' ? { latitude: near.latitude, longitude: near.longitude } : null), [near]);
  const open = nearby.bars.filter((b) => b.open).length;
  const eyebrow = `${placeName(area, nearby.bars)}${open ? ' · open now' : ''}`;

  // The places menu, from the place line or the empty page's "Pick a city".
  const cities = useBarCities().data ?? [];
  const picker = usePopover();
  const head = useRef<ComponentRef<typeof View>>(null);
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const places = placeSections({ area, preferNear, onArea, onNearMe }, cities);

  usePublishSearchArea({
    label: area.kind === 'anywhere' ? null : 'This area',
    area,
    kinds: NO_KINDS,
    onKind: (k) => ranksFor(k) && setStyleId(k),
    onPlace: onCity,
  });

  const where = areaLabel(area);
  const techniques = useVenueFeature('techniques');
  const label = `Best ${best.style.label} ${area.kind === 'point' && area.source === 'me' ? 'near you' : where}`;
  const onAll = best.classicId ? () => router.push(`/rankings/${best.classicId}` as Href) : undefined;
  const bestList = <BestNear label={label} classic={best.style.classics[0] ?? ''} where={where} rows={rows} limit={limit} state={best.isLoading ? 'loading' : best.error ? 'error' : undefined} onRetry={() => void best.refetch()} onAll={onAll} highlight={split ? (hover ?? rows[0]?.barId ?? null) : null} onHover={split ? setHover : undefined} />;

  // Learn (Kept-learn, "Learn, from Discover"): techniques, kit and pairings, under the lists.
  // At a venue, only with Techniques switched on (lib/venueFeatures.ts).
  const learn = techniques ? <LinkRow title="Learn" detail="Techniques, kit and pairings" href="/learn" icon="book" /> : null;

  const body = offline ? (
    <DiscoverOffline />
  ) : nearby.error && !nearby.bars.length ? (
    <PencilState kind="error" title="Discover didn’t load." detail="The connection dropped halfway." action={{ label: 'Try again', onPress: () => void nearby.refetch() }} />
  ) : nearby.isLoading ? (
    <DiscoverLoading />
  ) : !nearby.bars.length ? (
    <View ref={anchor} collapsable={false}>
      <PencilState kind="empty" title="Nothing near you yet. Try a city, or follow a bar you love." action={{ label: 'Pick a city', onPress: () => picker.open(anchor.current) }} />
    </View>
  ) : split ? (
    <View style={styles.body}>
      <DeskChips openOnly={openOnly} onOpenOnly={setOpenOnly} styleId={styleId} onStyle={setStyleId} late={late} onLate={setLate} />
      {bestList}
      {learn}
    </View>
  ) : (
    <View style={styles.body}>
      <MapCard bars={nearby.bars} named={named.slice(0, PHONE_NAMES)} area={area} me={me} caption={mapCaption(open, nearby.total, area)} />
      {bestList}
      <NewMenus menus={menus.menus} />
      {learn}
    </View>
  );

  // Near me on an iPhone's (and phone web's) top row; Android's top is its search bar, and the desktop draws none.
  const nearMe = Platform.OS === 'android' || wideWeb ? undefined : <GlassButton icon="location" accessibilityLabel="Near me" onPress={onNearMe} />;
  const list = (
    <ScrollView style={split ? { width: DESK_LIST + space.xxxl * 2, flexGrow: 0 } : undefined} contentContainerStyle={{ paddingBottom: bottom }}>
      <ScreenHeader place={false} add={false} actions={nearMe} />
      <View style={[split ? styles.deskColumn : column, styles.page]}>
        <View ref={head} collapsable={false}>
          <TonightHead title="Discover" eyebrow={eyebrow} eyebrowLabel={`${eyebrow}. Where to look`} onEyebrow={() => picker.open(head.current)} />
        </View>
        <AreaNote note={note} off={near.status === 'denied'} />
        {body}
      </View>
    </ScrollView>
  );
  return (
    <View style={[styles.screen, split ? styles.row : null, { backgroundColor: ds.c.ground }]}>
      {list}
      {split && !offline ? <MapCard pane bars={shown} named={named} area={area} me={me} selectedId={hover ?? rows[0]?.barId ?? null} /> : null}
      <PopoverMenu anchor={picker.anchor} label="Where to look" onClose={picker.close} sections={places} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: 'row' },
  page: { gap: space.lg },
  deskColumn: { paddingHorizontal: space.xxxl, maxWidth: DESK_LIST + space.xxxl * 2 },
  body: { gap: space.xl },
});
