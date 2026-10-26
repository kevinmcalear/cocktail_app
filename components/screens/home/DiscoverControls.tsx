import { useEffect, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body, DsText, GlassButton, GlassSurface, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import type { Area } from '@/lib/nearMe';

/** What the area chip says: "Near me", "London", "This area", "Anywhere". */
export function areaChipLabel(area: Area, preferNear: boolean): string {
  if (area.kind === 'point') return area.source === 'me' ? 'Near me' : 'This area';
  if (area.kind === 'city') return area.label;
  return preferNear ? 'Near me' : 'Anywhere';
}

/**
 * Discover's one search: a pill that opens the search sheet. It shows the
 * query once there is one, with a clear button that's always there.
 * `compact`: 44 tall, to sit in a header row beside the logo and you.
 * `label`: what a screen reader hears before there's a query, when the
 * placeholder is shortened to fit. `place`: where it looks, at its end after
 * a line (PlaceToken, discover-options-proposal).
 */
export function SearchPill({ query, placeholder, label = placeholder, onOpen, onClear, compact, place }: { query: string; placeholder: string; label?: string; onOpen: () => void; onClear: () => void; compact?: boolean; place?: ReactNode }) {
  const ds = useDs();
  const q = query.trim();
  // A short "Search" before the place keeps its width; the place gives way first. A query gives way to the place.
  const keep = !!place && !q;
  return (
    <GlassSurface interactive style={[styles.pill, compact ? styles.compact : null, place ? styles.placed : null]}>
      <PressableScale
        role="button"
        accessibilityLabel={q ? `Search: ${q}. Change the search` : label}
        onPress={onOpen}
        style={[styles.pillOpen, compact ? styles.compactOpen : null, keep ? styles.keep : null]}
      >
        <IconSymbol name="magnifyingglass" size={18} color={ds.c.muted} />
        <Body numberOfLines={1} tone={q ? 'ink' : 'muted'} style={keep ? null : styles.flex}>
          {q || placeholder}
        </Body>
      </PressableScale>
      {q ? (
        <PressableScale accessibilityLabel="Clear the search" onPress={onClear} hitSlop={4} style={styles.clear}>
          <IconSymbol name="xmark.circle.fill" size={20} color={ds.c.muted} />
        </PressableScale>
      ) : null}
      {place ? (
        <>
          <View style={[styles.line, { backgroundColor: ds.c.lineStrong }]} />
          {place}
        </>
      ) : null}
    </GlassSurface>
  );
}

/**
 * Phones: Discover's search in the docked sheet, as Google Maps has it (Q29,
 * Kevin's OK 26 Oct): where the Search tab's field will be, so a tap doesn't
 * move it. It shows the search or picked style once there is one, with a clear.
 */
export function SheetSearch({ query, onOpen, onClear }: { query: string; onOpen: () => void; onClear: () => void }) {
  const ds = useDs();
  const q = query.trim();
  return (
    <View style={[styles.sheetSearch, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <PressableScale role="button" accessibilityLabel={q ? `Search: ${q}. Change the search` : 'Search this area'} onPress={onOpen} style={styles.pillOpen}>
        <IconSymbol name="magnifyingglass" size={18} color={ds.c.muted} />
        <Body numberOfLines={1} tone={q ? 'ink' : 'muted'} style={styles.flex}>
          {q || 'Search this area'}
        </Body>
      </PressableScale>
      {q ? (
        <PressableScale accessibilityLabel="Clear the search" onPress={onClear} hitSlop={4} style={styles.clear}>
          <IconSymbol name="xmark.circle.fill" size={20} color={ds.c.muted} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/**
 * The pill while a bar on the phone map is open (disc-map-bar): a back arrow
 * to the results and the bar's name, as Google Maps does, so the card below
 * is just the bar. The name opens search; Android's back button goes back too.
 */
export function BackPill({ name, onBack, onOpen }: { name: string; onBack: () => void; onOpen: () => void }) {
  const ds = useDs();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (onBack(), true));
    return () => sub.remove();
  }, [onBack]);
  return (
    <GlassSurface interactive style={[styles.pill, styles.compact]}>
      <PressableScale role="button" accessibilityLabel="Back to the results" onPress={onBack} hitSlop={4} style={styles.clear}>
        <IconSymbol name="chevron.left" size={20} color={ds.c.ink} />
      </PressableScale>
      <PressableScale role="button" accessibilityLabel={`${name}. Search`} onPress={onOpen} style={[styles.pillOpen, styles.back]}>
        <Body numberOfLines={1} style={styles.flex}>
          {name}
        </Body>
      </PressableScale>
    </GlassSurface>
  );
}

/** How many filters are on, in the accent, on the Filters button. */
function Count({ n, style }: { n: number; style?: StyleProp<ViewStyle> }) {
  const ds = useDs();
  return (
    <View aria-hidden style={[styles.count, { backgroundColor: ds.accentFill.fill }, style]}>
      <DsText variant="caption" color={ds.accentFill.text} style={styles.countText}>
        {n}
      </DsText>
    </View>
  );
}

const filtersLabel = (filters: number) => (filters ? `Filters, ${filters} on` : 'Filters');

/** Filters, and how many are on, as a glass chip beside the wide pill (discover-options-proposal); also beside the scope while searching (disc-desk-search). */
export function FiltersChip({ filters, onPress }: { filters: number; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={filtersLabel(filters)} onPress={onPress}>
      <GlassSurface interactive style={styles.chip}>
        <IconSymbol name="line.3.horizontal.decrease" size={16} color={ds.c.ink} />
        <DsText variant="label">Filters</DsText>
        {filters ? <Count n={filters} /> : null}
      </GlassSurface>
    </PressableScale>
  );
}

/** The phone header's round Filters button, the count on its corner. */
export function FiltersButton({ filters, onPress }: { filters: number; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={filtersLabel(filters)} onPress={onPress} hitSlop={4}>
      <GlassSurface interactive style={styles.round}>
        <IconSymbol name="line.3.horizontal.decrease" size={18} color={ds.c.ink} />
      </GlassSurface>
      {filters ? <Count n={filters} style={styles.corner} /> : null}
    </PressableScale>
  );
}

/** "Search this area", once the person has moved the map. */
export function SearchHere({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.center}>
      <GlassButton accessibilityLabel="Search this area" label="Search this area" icon="magnifyingglass" onPress={onPress} />
    </View>
  );
}

/** How the drinks are ordered (DiscoverOptions.tsx): mixed (browsing; "Best match" searching), a style's best first ("Top rated" searching), or nearest. */
export type MapLayer = 'drinks' | 'best' | 'nearest';

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  // 48 tall, as every Discover board draws its search (disc-desk-browse, disc-map).
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minTapTarget + space.xs,
    paddingRight: space.xs,
  },
  pillOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, minHeight: layout.minTapTarget + space.xs, paddingLeft: space.lg + 2 },
  compact: { minHeight: layout.minTapTarget },
  sheetSearch: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingRight: space.xs },
  compactOpen: { minHeight: layout.minTapTarget, paddingLeft: space.md, gap: space.xs + 2 },
  keep: { flexShrink: 0, flexBasis: 'auto' },
  // The arrow sits where the magnifier was; the name starts right after it.
  back: { minHeight: layout.minTapTarget, paddingLeft: 0 },
  clear: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  // The place token ends the pill, so it has no room of its own on the right.
  placed: { paddingRight: 0 },
  line: { width: StyleSheet.hairlineWidth, height: space.lg + space.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget + space.xs, paddingHorizontal: space.lg },
  round: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 20, height: 20, paddingHorizontal: space.xs, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: fontFamilies.bodySemiBold },
  corner: { position: 'absolute', top: -space.xs, right: -space.xs },
});
