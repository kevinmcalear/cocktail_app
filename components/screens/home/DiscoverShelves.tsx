import { useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Caption, DrinkImage, DsText, Headline, PalateFlower, PressableScale, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { BarMark } from '@/components/screens/home/BarMark';
import { BarAway } from '@/components/screens/home/DrinksAtBars';
import { fontFamilies, radius, space, type } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { usePrefetchCocktail } from '@/hooks/useCocktails';
import { useMyTaste } from '@/hooks/useFlavor';
import type { DiscoverDrink } from '@/lib/discoverDrinks';
import type { Shelf } from '@/lib/discoverShelves';
import { itemHref } from '@/lib/itemRoutes';

const TILE = 112;
const GAP = space.md;
const AT_BAR_MIN = 100;
/** A small mark, bottom left of the picture, with the bar's name beside it. */
const MARK = 20;

/** The palate, then "Based on your taste". The whole line opens the taste page. */
function TasteLine({ note }: { note: string }) {
  const router = useRouter();
  const { data: me } = useMyTaste();
  const taste = me?.taste;
  return (
    <PressableScale role="link" accessibilityLabel={`${note}. Open your taste`} hitSlop={12} onPress={() => router.push('/taste' as never)} style={styles.note}>
      {taste && Object.keys(taste).length ? <PalateFlower values={taste} size={28} rings={false} /> : null}
      <Caption tone="muted">{note}</Caption>
    </PressableScale>
  );
}

/** One drink on a shelf. `atBar`: already inside that bar's panel, so just the drawing and the drink. `size`: a grid's tile width. */
export function ShelfTile({ drink: d, onShowBar, atBar = false, size = TILE }: { drink: DiscoverDrink; onShowBar?: (barId: string | null) => void; atBar?: boolean; size?: number }) {
  const router = useRouter();
  const ds = useDs();
  const prefetch = usePrefetchCocktail();
  const away = useContext(BarAway)(d.barId);
  const place = away ?? d.bar.locality;
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[d.name, d.bar.name, place].filter(Boolean).join('. ')}
      onPressIn={() => prefetch(d.id, { name: d.name, imageUrl: d.imageUrl })}
      onPress={() => router.push(itemHref('Cocktail', d.id) as never)}
      onHoverIn={onShowBar ? () => onShowBar(d.barId) : undefined}
      onHoverOut={onShowBar ? () => onShowBar(null) : undefined}
      onFocus={onShowBar ? () => onShowBar(d.barId) : undefined}
      onBlur={onShowBar ? () => onShowBar(null) : undefined}
      style={[styles.tile, { width: size }]}
    >
      <View style={[styles.picture, { width: size, backgroundColor: ds.c.paper }]}>
        {place && !atBar ? (
          <Caption numberOfLines={1} color={withAlpha(ds.c.sketchInk, 0.55)} style={[styles.away, { maxWidth: size - space.md }]}>
            {place}
          </Caption>
        ) : null}
        <DrinkImage thumb source={d.imageUrl} itemId={d.id} radius={0} accessibilityLabel={d.name} style={{ width: size, height: size }} />
        {atBar ? null : (
          <View style={styles.barRow}>
            <BarMark name={d.bar.name} logoUrl={d.bar.logo} profileId={d.barId} size={MARK} />
            <Caption numberOfLines={1} color={ds.c.sketchInk} style={styles.bar}>
              {d.bar.name}
            </Caption>
          </View>
        )}
      </View>
      <DsText variant="label" numberOfLines={2}>
        {d.name}
      </DsText>
    </PressableScale>
  );
}

/** As many tiles across as fit at `min` or wider (3 in a 428 list, 4 in 640). A bar's own tiles carry no bar line, so they may be smaller. */
export function gridColumns(width: number, min = TILE): number {
  return Math.max(1, Math.floor((width + GAP) / (min + GAP)));
}

/**
 * Wide screens' shelves (disc-desk-wide): a grid, `rows` deep, never a row that
 * scrolls sideways. `showAll` adds a button that opens the rest in place.
 */
export function TileGrid({ drinks, rows = 2, atBar, showAll, onShowBar, style }: { drinks: DiscoverDrink[]; rows?: number; atBar?: boolean; showAll?: string; onShowBar?: (barId: string | null) => void; style?: StyleProp<ViewStyle> }) {
  const ds = useDs();
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState(false);
  const cols = width ? gridColumns(width, atBar ? AT_BAR_MIN : TILE) : 3;
  const size = width ? Math.floor((width - GAP * (cols - 1)) / cols) : TILE;
  const shown = open ? drinks : drinks.slice(0, cols * rows);
  return (
    <View style={[styles.grid, style]}>
      <View role="list" style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {shown.map((d) => (
          <View role="listitem" key={d.id}>
            <ShelfTile drink={d} atBar={atBar} size={size} onShowBar={onShowBar} />
          </View>
        ))}
      </View>
      {showAll && drinks.length > cols * rows ? (
        <PressableScale role="button" aria-expanded={open} hitSlop={8} onPress={() => setOpen(!open)} style={styles.showAll}>
          <DsText variant="label" color={ds.accentText}>
            {open ? 'Show fewer' : showAll}
          </DsText>
        </PressableScale>
      ) : null}
    </View>
  );
}

/**
 * Discover's shelves over the list (disc-list, disc-desk-wide): each a
 * titled row that scrolls sideways on phones and a two-row grid on wide
 * screens, one drink per bar, with See all setting its filter on the list
 * below. Empty shelves never reach here.
 */
export function DiscoverShelves({ shelves, onKind, onShowBar }: { shelves: Shelf[]; onKind?: (kind: string) => void; /** Hovering a card opens its bar on the map. */ onShowBar?: (barId: string | null) => void }) {
  const gutter = useGutter();
  const ds = useDs();
  const wide = useBreakpoint() !== 'phone';
  return shelves.map((s) => (
    <View key={s.key} role="region" aria-label={s.title} style={styles.shelf}>
      <View>
        <View style={styles.head}>
          <Headline role="heading" style={styles.flex}>
            {s.title}
          </Headline>
          {s.kind && onKind ? (
            <PressableScale accessibilityLabel={`See all: ${s.title}`} hitSlop={12} onPress={() => onKind(s.kind!)}>
              <DsText variant="caption" color={ds.accentText}>
                See all
              </DsText>
            </PressableScale>
          ) : null}
        </View>
        {s.taste ? <TasteLine note={s.note} /> : <Caption tone="muted">{s.note}</Caption>}
      </View>
      {wide ? (
        // A shelf with no See all opens its own rest in place.
        <TileGrid drinks={s.drinks} showAll={s.kind && onKind ? undefined : 'Show all'} onShowBar={onShowBar} />
      ) : (
      // Runs to the screen's edges, so a cut-off tile says there's more.
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter }}>
        <View role="list" style={styles.row}>
          {s.drinks.map((d) => (
            <View role="listitem" key={d.id}>
              <ShelfTile drink={d} onShowBar={onShowBar} />
            </View>
          ))}
        </View>
      </ScrollView>
      )}
    </View>
  ));
}

const styles = StyleSheet.create({
  shelf: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  note: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: space.md },
  grid: { gap: space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: space.lg },
  showAll: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  tile: { gap: space.xs },
  picture: { borderRadius: radius.control, overflow: 'hidden' },
  // ponytail: 11pt, under the 13 caption floor, so the strip stays quieter than the bar name. A micro style if a second place needs it.
  away: {
    alignSelf: 'flex-end',
    marginTop: space.xs,
    marginRight: space.sm,
    marginBottom: space.xs,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: type.caption.fontSize - 2,
    lineHeight: type.caption.lineHeight - 4,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, padding: space.xs, paddingBottom: space.sm },
  bar: { flex: 1, minWidth: 0, fontFamily: fontFamilies.bodySemiBold },
});
