import { StyleSheet, View } from 'react-native';

import { Body, Caption, GlassButton, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
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
    <View style={[styles.pill, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
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
    </View>
  );
}

function RowButton({ icon, label, a11y, active, onPress }: { icon: IconName; label: string; a11y: string; active: boolean; onPress: () => void }) {
  const ds = useDs();
  const ink = active ? ds.c.ground : ds.c.ink;
  return (
    <PressableScale
      accessibilityLabel={a11y}
      onPress={onPress}
      style={[styles.button, { backgroundColor: active ? ds.c.ink : ds.c.raised, borderColor: active ? ds.c.ink : ds.c.line }]}
    >
      <IconSymbol name={icon} size={16} color={ink} />
      <Caption numberOfLines={1} color={ink} style={styles.shrink}>
        {label}
      </Caption>
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

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minTapTarget,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingRight: space.sm,
  },
  pillOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, paddingLeft: space.lg },
  clear: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: layout.minTapTarget,
    maxWidth: 200,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
