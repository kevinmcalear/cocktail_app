import { StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, GlassButton, GlassSurface, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
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
 */
export function SearchPill({ query, placeholder, onOpen, onClear }: { query: string; placeholder: string; onOpen: () => void; onClear: () => void }) {
  const ds = useDs();
  const q = query.trim();
  return (
    <GlassSurface interactive style={styles.pill}>
      <PressableScale
        role="button"
        accessibilityLabel={q ? `Search: ${q}. Change the search` : placeholder}
        onPress={onOpen}
        style={styles.pillOpen}
      >
        <IconSymbol name="magnifyingglass" size={18} color={ds.c.muted} />
        <Body numberOfLines={1} tone={q ? 'ink' : 'muted'} style={styles.flex}>
          {q || placeholder}
        </Body>
      </PressableScale>
      {q ? (
        <PressableScale accessibilityLabel="Clear the search" onPress={onClear} hitSlop={4} style={styles.clear}>
          <IconSymbol name="xmark.circle.fill" size={20} color={ds.c.muted} />
        </PressableScale>
      ) : null}
    </GlassSurface>
  );
}

function RowButton({ icon, label, a11y, active, onPress }: { icon: IconName; label: string; a11y: string; active: boolean; onPress: () => void }) {
  const ds = useDs();
  const ink = active ? ds.c.ground : ds.c.ink;
  return (
    <PressableScale accessibilityLabel={a11y} onPress={onPress} style={styles.buttonWrap}>
      <GlassSurface interactive tint={active ? ds.c.ink : undefined} style={styles.button}>
        <IconSymbol name={icon} size={16} color={ink} />
        <Caption numberOfLines={1} color={ink} style={styles.shrink}>
          {label}
        </Caption>
      </GlassSurface>
    </PressableScale>
  );
}

interface FilterRowProps {
  area: Area;
  preferNear: boolean;
  /** How many styles, spirits and tasting notes are picked. */
  filters: number;
  onArea: () => void;
  onFilters: () => void;
  /** Phones: switch between the list and the map. */
  view?: { showing: 'list' | 'map'; onToggle: () => void };
}

/** Where (the area chip), what (Filters), and the list or map, in one row. */
export function FilterRow({ area, preferNear, filters, onArea, onFilters, view }: FilterRowProps) {
  const where = areaChipLabel(area, preferNear);
  return (
    <View style={styles.row}>
      <RowButton icon="mappin.and.ellipse" label={where} a11y={`Where: ${where}. Change`} active={false} onPress={onArea} />
      <RowButton
        icon="line.3.horizontal.decrease"
        label={filters ? `Filters · ${filters}` : 'Filters'}
        a11y={filters ? `Filters, ${filters} on` : 'Filters'}
        active={filters > 0}
        onPress={onFilters}
      />
      <View style={styles.flex} />
      {view ? (
        view.showing === 'map' ? (
          <GlassButton accessibilityLabel="Show the list" label="List" icon="list.bullet" onPress={view.onToggle} />
        ) : (
          <GlassButton accessibilityLabel="Show the map" label="Map" icon="map.fill" onPress={view.onToggle} />
        )
      ) : null}
    </View>
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
}

/**
 * What the map shows: the matching drinks, a drink's best ("Best Martini")
 * or the top bars. Searching, they read as a sort of what was found: Best
 * match, Top rated, and Nearest when there's somewhere to measure from.
 */
export function MapLayers({ layer, onLayer, drinkName, searching, nearest }: MapLayersProps) {
  return (
    <View role="radiogroup" accessibilityLabel="Show on the map" style={styles.chips}>
      <Chip label={searching ? 'Best match' : 'Drinks'} selected={layer === 'drinks'} onPress={() => onLayer('drinks')} />
      {drinkName ? <Chip label={searching ? 'Top rated' : `Best ${drinkName}`} selected={layer === 'best'} onPress={() => onLayer('best')} /> : null}
      {nearest ? <Chip label="Nearest" selected={layer === 'nearest'} onPress={() => onLayer('nearest')} /> : null}
      {searching ? null : <Chip label="Top bars" selected={layer === 'bars'} onPress={() => onLayer('bars')} />}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  center: { alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minTapTarget,
    paddingRight: space.sm,
  },
  pillOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, paddingLeft: space.lg },
  clear: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  buttonWrap: { maxWidth: 200 },
  button: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: layout.minTapTarget, paddingHorizontal: space.md },
});
