import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Caption, DrinkImage, DsText, PressableScale, useDs } from '@/components/ds';
import { BarMark } from '@/components/screens/home/BarMark';
import { font, radius, space, type } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { usePrefetchCocktail } from '@/hooks/useCocktails';
import type { DiscoverDrink } from '@/lib/discoverDrinks';
import { itemHref } from '@/lib/itemRoutes';

const TILE = 112;
const GAP = space.md;
const AT_BAR_MIN = 100;
/** A small mark, bottom left of the picture, with the bar's name beside it. */
const MARK = 20;

/** One drink on a shelf. `atBar`: already inside that bar's panel, so just the drawing and the drink. `size`: a grid's tile width. */
export function ShelfTile({ drink: d, onShowBar, atBar = false, size = TILE }: { drink: DiscoverDrink; onShowBar?: (barId: string | null) => void; atBar?: boolean; size?: number }) {
  const router = useRouter();
  const ds = useDs();
  const prefetch = usePrefetchCocktail();
  const place = d.bar.locality;
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

const styles = StyleSheet.create({
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
    ...font.medium,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, padding: space.xs, paddingBottom: space.sm },
  bar: { flex: 1, minWidth: 0, ...font.semiBold },
});
