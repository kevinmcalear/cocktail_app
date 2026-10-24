import { useEffect, type ReactNode } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';

import { Body, Chip, DsText, GlassButton, GlassSurface, PressableScale, useDs } from '@/components/ds';
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
function Count({ n, style }: { n: number; style?: object }) {
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

/** The List / Map pill's height: its buttons in the track's padding. */
export const VIEW_PILL = layout.minTapTarget + space.xs;
const VIEW_BUTTON = VIEW_PILL - 2 * space.xs;

const VIEWS = [
  { value: 'list', label: 'List', icon: 'list.bullet' },
  { value: 'map', label: 'Map', icon: 'map.fill' },
] as const;

/**
 * List / Map, floating over the phone's content (discover-options-proposal),
 * as Airbnb and Yelp have it. It stays put as the list scrolls. The one
 * showing is a solid ink pill.
 */
export function ViewPill({ showing, onChange }: { showing: 'list' | 'map'; onChange: (view: 'list' | 'map') => void }) {
  const ds = useDs();
  return (
    <GlassSurface interactive style={[styles.track, styles.lifted, { shadowColor: ds.c.ground }]}>
      <View role="radiogroup" accessibilityLabel="Show as" style={styles.views}>
        {VIEWS.map((v) => {
          const on = v.value === showing;
          const ink = on ? ds.c.ground : ds.c.ink;
          return (
            <PressableScale key={v.value} role="radio" aria-checked={on} accessibilityLabel={v.label} onPress={() => onChange(v.value)} style={[styles.view, on ? { backgroundColor: ds.c.ink } : null]}>
              <IconSymbol name={v.icon} size={16} color={ink} />
              <DsText variant="label" color={ink}>
                {v.label}
              </DsText>
            </PressableScale>
          );
        })}
      </View>
    </GlassSurface>
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

export type MapLayer = 'drinks' | 'best' | 'bars' | 'nearest';

interface MapLayersProps {
  layer: MapLayer;
  onLayer: (layer: MapLayer) => void;
  /** The drink picked on Discover, for "Best Martini". */
  drinkName: string | null;
  searching: boolean;
  /** Whether there's a place to measure Nearest from. */
  nearest: boolean;
  /** Over the map, in a glass track: the unpicked ones rest bare. */
  onGlass?: boolean;
}

/**
 * What the map shows: the matching drinks, a drink's best ("Best Martini")
 * or the top bars. Searching, they read as a sort of what was found: Best
 * match, Top rated, and Nearest when there's somewhere to measure from.
 */
export function MapLayers({ layer, onLayer, drinkName, searching, nearest, onGlass }: MapLayersProps) {
  const look = onGlass ? 'glass' : 'outline';
  return (
    <View role="radiogroup" accessibilityLabel="Show on the map" style={[styles.chips, onGlass ? styles.glassChips : null]}>
      <Chip look={look} label={searching ? 'Best match' : 'Drinks'} selected={layer === 'drinks'} onPress={() => onLayer('drinks')} />
      {drinkName ? <Chip look={look} label={searching ? 'Top rated' : `Best ${drinkName}`} selected={layer === 'best'} onPress={() => onLayer('best')} /> : null}
      {nearest ? <Chip look={look} label="Nearest" selected={layer === 'nearest'} onPress={() => onLayer('nearest')} /> : null}
      {searching ? null : <Chip look={look} label="Top bars" selected={layer === 'bars'} onPress={() => onLayer('bars')} />}
    </View>
  );
}

/** The layers over the map in a glass track, scrolling sideways when they don't fit (a phone's four, with Nearest). */
export function GlassLayers(props: Omit<MapLayersProps, 'onGlass'>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.edge} contentContainerStyle={styles.edgeRow}>
      <GlassSurface style={styles.track}>
        <MapLayers {...props} onGlass />
      </GlassSurface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  glassChips: { gap: space.xs + 2 },
  center: { alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  // 48 tall, as every Discover board draws its search (disc-desk-browse, disc-map).
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minTapTarget + space.xs,
    paddingRight: space.xs,
  },
  pillOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, minHeight: layout.minTapTarget + space.xs, paddingLeft: space.lg + 2 },
  compact: { minHeight: layout.minTapTarget },
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
  track: { padding: space.xs, borderRadius: radius.pill },
  // Edge to edge, so the track scrolls out under the screen's sides.
  edge: { marginHorizontal: -space.lg, flexGrow: 0 },
  edgeRow: { paddingHorizontal: space.lg },
  lifted: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 24, elevation: 6 },
  views: { flexDirection: 'row', gap: 2 },
  view: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: VIEW_BUTTON, paddingHorizontal: space.lg, borderRadius: radius.pill, borderCurve: 'continuous' },
});
