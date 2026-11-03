import { getLocales } from 'expo-localization';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, Chip, DrinkImage, DsText, GlassButton, GlassSurface, Headline, PencilState, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { BarMark } from '@/components/screens/home/BarMark';
import { DiscoverMap, mapAvailable } from '@/components/screens/home/DiscoverMap';
import { MapCredit } from '@/components/screens/home/MapCredit';
import { OfflineNote, SavedChip } from '@/components/screens/home/OfflineParts';
import { DrinkTile, TonightLabel } from '@/components/screens/tonight/TonightParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, layout, radius, space } from '@/constants/tokens';
import type { MapBar } from '@/hooks/useDiscoverHome';
import { useLovedBars } from '@/hooks/useKept';
import { hoursLine } from '@/lib/barHours';
import type { BestRow, NewMenu } from '@/lib/discoverHome';
import { pinOf } from '@/lib/discoverDrinks';
import { cameraFor, cameraForArea, type MapPin } from '@/lib/discoverMap';
import { itemHref } from '@/lib/itemRoutes';
import { formatDistance, usesMiles, type Area } from '@/lib/nearMe';
import { formatScore, MIN_RANKERS } from '@/lib/ranking';
import { STYLES } from '@/lib/drinkStyles';

const noop = () => {};

/** How many bars the phone's map names (Prod-discover draws two). */
export const PHONE_NAMES = 2;

/** The area's bars as their marks on the map, the `named` ones (else the first two) with their names. */
export function useBarPins(bars: readonly MapBar[], named: readonly string[]): MapPin[] {
  const ds = useDs();
  const family = displayFaces[ds.displayFace].regular;
  return useMemo(() => {
    const mark = { edge: ds.c.ground, ink: ds.c.ink, family };
    const lead = named.length ? named : bars.slice(0, PHONE_NAMES).map((b) => b.id);
    return bars.flatMap((b) => {
      const pin = pinOf(b, b.drinks);
      if (!pin) return [];
      const at = lead.indexOf(b.id);
      return { ...pin, mark, named: at >= 0, order: at >= 0 ? at : undefined };
    });
  }, [bars, named, ds.c.ground, ds.c.ink, family]);
}

/**
 * The map: the area's bars as their marks, a tap opening the bar. On phones a
 * card in the page with "12 bars open near you" on glass (Prod-discover); on
 * the desktop the tall pane beside the list (Prod-desk-discover), where the
 * hovered row's bar stands out. Phones show the map's credit under the card.
 */
export function MapCard({ bars, named, area, me, caption, selectedId = null, pane = false, onExpand }: { bars: readonly MapBar[]; named: readonly string[]; area: Area; me: { latitude: number; longitude: number } | null; caption?: string; selectedId?: string | null; pane?: boolean; /** Phones: the full map (DiscoverFullMap). */ onExpand?: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const pins = useBarPins(bars, named);
  // Near me opens on the neighbourhood, a city on its bars. A new camera object moves the map, so the same view keeps the object (hours or a hover can't undo a pan).
  const fit = cameraForArea(area, me) ?? cameraFor(pins);
  const [camera, setCamera] = useState(fit);
  if (fit?.latitude !== camera?.latitude || fit?.longitude !== camera?.longitude || fit?.zoom !== camera?.zoom) setCamera(fit);
  const open = (id: string | null) => {
    const pin = id ? pins.find((p: MapPin) => p.id === id) : null;
    if (pin) router.push(`/p/${pin.handle}` as Href);
  };
  return (
    <View style={pane ? styles.pane : styles.cardWrap}>
      <View style={[pane ? styles.paneMap : styles.card, { backgroundColor: ds.c.raised }]}>
        {mapAvailable ? (
          <DiscoverMap pins={pins} me={me} selectedId={selectedId} onSelect={open} onViewportChange={noop} camera={camera} scheme={ds.scheme} accent={ds.accentFill} compact={!pane} style={StyleSheet.absoluteFill} />
        ) : null}
        {/* A tap on the caption opens the map too; screen readers get the one Open the map button beside it, and the caption as status. */}
        {caption ? (
          <PressableScale accessible={false} focusable={false} onPress={onExpand} disabled={!onExpand} style={styles.caption}>
            <GlassSurface style={styles.captionGlass}>
              <DsText variant="label" role="status">
                {caption}
              </DsText>
            </GlassSurface>
          </PressableScale>
        ) : null}
        {onExpand ? (
          <View style={styles.expand}>
            <GlassButton icon="map.fill" accessibilityLabel="Open the map" onPress={onExpand} />
          </View>
        ) : null}
      </View>
      {pane ? null : <MapCredit />}
    </View>
  );
}

/** One ranked row (Prod-discover): the place, the drawing, the drink and its bar and distance, the score and how many ranks. */
function BestRowView({ row, highlight, onHover }: { row: BestRow; highlight: boolean; onHover?: (barId: string | null) => void }) {
  const ds = useDs();
  const router = useRouter();
  const face = { fontFamily: displayFaces[ds.displayFace].regular };
  const away = row.distanceKm !== null ? formatDistance(row.distanceKm, usesMiles(getLocales()[0])) : null;
  const sub = [row.barName, away].filter(Boolean).join(' · ');
  const ranks = `${row.rankers} ${row.rankers === 1 ? 'rank' : 'ranks'}`;
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`Number ${row.position}: ${row.name}, ${sub}. Score ${formatScore(row.score)}, ${ranks}`}
      onPress={() => router.push((row.drinkId ? itemHref('Cocktail', row.drinkId) : `/p/${row.barHandle}`) as Href)}
      onHoverIn={onHover ? () => onHover(row.barId) : undefined}
      onFocus={onHover ? () => onHover(row.barId) : undefined}
      style={[styles.row, { borderBottomColor: ds.c.line }, highlight ? [styles.lit, { backgroundColor: ds.c.raised }] : null]}
    >
      <Headline tone="muted" style={[styles.position, face]}>
        {row.position}
      </Headline>
      {row.drinkId ? <DrinkImage itemId={row.drinkId} glass={null} accessibilityLabel="" radius={0} style={styles.drawing} thumb /> : <BarMark name={row.barName} profileId={row.barId} size={layout.minTapTarget} />}
      <View style={styles.flex}>
        <Headline numberOfLines={1} style={face}>
          {row.name}
        </Headline>
        <Caption tone="muted" numberOfLines={1}>
          {sub}
        </Caption>
      </View>
      <View style={styles.score}>
        <Headline style={face}>{formatScore(row.score)}</Headline>
        <Caption tone="muted">{ranks}</Caption>
      </View>
    </PressableScale>
  );
}

/**
 * "Best Martinis near you", All, and the ranked rows. Before 20 people have
 * ranked one there, the words Sta-rankings uses instead of rows. `state`:
 * the rankings are still coming, or didn't come.
 */
export function BestNear({ label, classic, where, rows, limit, state, onRetry, onAll, highlight, onHover }: { label: string; classic: string; where: string; rows: readonly BestRow[]; limit: number; state?: 'loading' | 'error'; onRetry?: () => void; onAll?: () => void; highlight?: string | null; onHover?: (barId: string | null) => void }) {
  return (
    <View role="region" accessibilityLabel={label} style={styles.section}>
      <TonightLabel title={label} aside={onAll ? 'All' : null} onAside={onAll} />
      {state === 'loading' ? (
        <RowsLoading />
      ) : state === 'error' ? (
        <PencilState kind="error" title="The rankings didn’t load." action={onRetry ? { label: 'Try again', onPress: onRetry } : undefined} />
      ) : rows.length ? (
        <View>
          {rows.slice(0, limit).map((r) => (
            <BestRowView key={r.barId} row={r} highlight={highlight === r.barId} onHover={onHover} />
          ))}
        </View>
      ) : (
        <Caption tone="muted">{`Not enough rankers yet ${where}. A bar’s ${classic} shows here once ${MIN_RANKERS} people have ranked it there.`}</Caption>
      )}
    </View>
  );
}

/** New menus: a tile each, the first drink's drawing on its colour, the menu's name and its bar (Prod-discover). */
export function NewMenus({ menus }: { menus: readonly NewMenu[] }) {
  const router = useRouter();
  if (!menus.length) return null;
  return (
    <View role="region" accessibilityLabel="New menus" style={styles.section}>
      <TonightLabel title="New menus" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
        {menus.map((m) =>
          m.drinkId ? (
            <DrinkTile key={m.id} id={m.drinkId} name={m.name} status={m.sub} wide onPress={() => router.push(`/p/${m.barId}/menus/${m.id}` as Href)} />
          ) : null
        )}
      </ScrollView>
    </View>
  );
}

/** Desktop's chips (Prod-desk-discover): Open now, two styles for the ranked list, Late. */
export function DeskChips({ openOnly, onOpenOnly, styleId, onStyle, late, onLate }: { openOnly: boolean; onOpenOnly: (on: boolean) => void; styleId: string; onStyle: (id: string) => void; late: boolean; onLate: (on: boolean) => void }) {
  const styleChips = STYLES.filter((s) => s.id === 'martini' || s.id === 'sour');
  return (
    <View style={styles.chips}>
      <Chip label="Open now" selected={openOnly} multi onPress={() => onOpenOnly(!openOnly)} />
      {styleChips.map((s) => (
        <Chip key={s.id} label={s.label} selected={styleId === s.id} onPress={() => onStyle(s.id)} />
      ))}
      <Chip label="Late" selected={late} multi onPress={() => onLate(!late)} />
    </View>
  );
}

/**
 * Offline (Sta-discover): what's on this phone, the bars you love from the
 * saved list, and when the map comes back.
 */
export function DiscoverOffline() {
  const ds = useDs();
  const router = useRouter();
  const loved = useLovedBars().data ?? [];
  const phone = useBreakpoint() === 'phone';
  const now = new Date();
  return (
    <View style={styles.section}>
      <SavedChip label={phone ? 'Saved on this phone · offline' : 'Saved on this device · offline'} />
      {loved.length ? (
        <>
          <TonightLabel title="Bars you love" />
          {loved.map((b) => (
            <PressableScale key={b.id} role="link" accessibilityLabel={b.name} onPress={() => router.push(`/p/${b.handle}` as Href)} style={[styles.row, { borderBottomColor: ds.c.line }]}>
              <BarMark name={b.name} logoUrl={b.avatarUrl} profileId={b.id} size={layout.minTapTarget} />
              <View style={styles.flex}>
                <Headline numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
                  {b.name}
                </Headline>
                <Caption tone="muted" numberOfLines={1}>
                  {hoursLine(b.hours, now, b.timezone) ?? b.place ?? ''}
                </Caption>
              </View>
              <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
            </PressableScale>
          ))}
        </>
      ) : null}
      <OfflineNote text="The map and what’s near you come back with a connection." />
    </View>
  );
}

const LOADING_ROWS = [0, 1, 2];

/** Three rows in outline. */
function RowsLoading() {
  const ds = useDs();
  const outline = { borderColor: ds.c.line };
  return (
    <View style={styles.section}>
      {LOADING_ROWS.map((i) => (
        <View key={i} style={styles.loadingRow}>
          <View style={[styles.loadingPic, outline]} />
          <View style={styles.loadingBars}>
            <View style={[styles.loadingBar, styles.loadingLong, outline]} />
            <View style={[styles.loadingBar, styles.loadingShort, outline]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Loading (Sta-discover): the map card and three rows in outline. */
export function DiscoverLoading() {
  const ds = useDs();
  return (
    <View role="progressbar" accessibilityLabel="Loading Discover" style={styles.section}>
      <View style={[styles.outlineCard, { borderColor: ds.c.line }]} />
      <RowsLoading />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
  cardWrap: { gap: space.xs },
  // Prod-discover: 230 tall, round corners, the caption on glass at its foot.
  card: { height: 230, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  pane: { flex: 1, padding: space.xl },
  paneMap: { flex: 1, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  caption: { position: 'absolute', left: space.md, bottom: space.md },
  captionGlass: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm },
  expand: { position: 'absolute', top: space.md, right: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  // The desktop's hovered row, on a soft fill that reaches past the column (Prod-desk-discover's first row).
  lit: { borderRadius: radius.control, marginHorizontal: -space.sm, paddingHorizontal: space.sm },
  position: { width: 24, textAlign: 'center' },
  drawing: { width: 56, height: 56 },
  score: { alignItems: 'flex-end', gap: 2 },
  tiles: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  outlineCard: { height: 180, borderWidth: 1, borderRadius: radius.card },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 74 },
  loadingPic: { width: 52, height: 52, borderWidth: 1, borderRadius: radius.pill },
  loadingBars: { flex: 1, gap: space.sm },
  loadingBar: { height: 12, borderWidth: 1, borderRadius: radius.pill },
  loadingLong: { width: '62%' },
  loadingShort: { width: '38%' },
});
