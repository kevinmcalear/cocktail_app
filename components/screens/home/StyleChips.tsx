import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, DsText, GlassSurface, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import type { DiscoverDrink } from '@/lib/discoverDrinks';
import { chipIds, stylesByBars } from '@/lib/discoverShelves';
import { kindLabel } from '@/lib/drinkStyles';

/** The most chips the wide list shows, the ones on included. */
const LIST_MAX = 6;

interface StyleChipsProps {
  /** The styles (and spirits) on: Discover's filter, the same one the Filters sheet sets. */
  kinds: string[];
  onChange: (kinds: string[]) => void;
  /** The drinks in view, to order the chips by how many bars pour each style. */
  drinks: readonly DiscoverDrink[];
  /** Phones: one sideways row of glass pills over the map. Else they wrap, outlined, in the list. */
  onGlass?: boolean;
}

/**
 * The drink chips (disc-maps-habits, approved 24 Oct), like Google Maps'
 * Restaurants and Coffee: the styles bars here pour, the most bars first. A
 * chip turns on that style in Discover's filter, so browsing carries on and
 * the map still follows. The ones on lead, with an ×. The order is the last
 * unfiltered list's, so it holds still while a style is on and the list only
 * has that style.
 */
export function StyleChips({ kinds, onChange, drinks, onGlass }: StyleChipsProps) {
  const ds = useDs();
  const [order, setOrder] = useState<string[]>([]);
  // A chip turned on moves to the front: bring the row back to the start so it stays in sight.
  const row = useRef<ComponentRef<typeof ScrollView>>(null);
  const picked = kinds.join();
  useEffect(() => row.current?.scrollTo({ x: 0, animated: true }), [picked]);
  const counted = kinds.length ? [] : stylesByBars(drinks);
  if (counted.length && counted.join() !== order.join()) setOrder(counted);
  // The list wraps, so it keeps to one or two rows (the board's six); Filters has every style. The map's row scrolls.
  const ids = chipIds(kinds, counted.length ? counted : order, onGlass ? undefined : LIST_MAX);
  if (!ids.length) return null;
  const toggle = (id: string) => onChange(kinds.includes(id) ? kinds.filter((k) => k !== id) : [...kinds, id]);
  const chips = ids.map((id) => {
    const on = kinds.includes(id);
    const label = kindLabel(id);
    const a11y = on ? `${label}, on. Clear` : label;
    const x = on ? <IconSymbol name="xmark" size={11} color={ds.c.ground} /> : null;
    if (!onGlass) return <Chip key={id} multi quiet label={label} selected={on} trailing={x} accessibilityLabel={a11y} onPress={() => toggle(id)} />;
    return (
      <PressableScale key={id} role="checkbox" aria-checked={on} accessibilityLabel={a11y} onPress={() => toggle(id)} hitSlop={4}>
        <GlassSurface interactive tint={on ? ds.c.ink : undefined} style={styles.pill}>
          <DsText variant="label" color={on ? ds.c.ground : ds.c.ink} style={on ? styles.picked : null}>
            {label}
          </DsText>
          {x}
        </GlassSurface>
      </PressableScale>
    );
  });
  if (!onGlass) {
    return (
      <View role="group" accessibilityLabel="Drinks" style={styles.wrap}>
        {chips}
      </View>
    );
  }
  return (
    <ScrollView ref={row} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" role="group" accessibilityLabel="Drinks" style={styles.edge} contentContainerStyle={styles.row}>
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // Runs to the screen's edges over the map, so the row reads as one that scrolls.
  edge: { marginHorizontal: -space.lg, flexGrow: 0 },
  row: { gap: space.sm, paddingHorizontal: space.lg },
  // 36 tall with a 4-point hit slop makes the 44-point target, as the map's layer chips.
  pill: { minHeight: layout.minTapTarget - space.sm, paddingHorizontal: space.md + 2, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  picked: { fontFamily: fontFamilies.bodySemiBold },
});
