import { LinearGradient } from 'expo-linear-gradient';
import { useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, DockFade, GlassSurface, PopoverMenu, PressableScale, useDs, useGutter, usePopover, type Ds } from '@/components/ds';
import { Appear } from '@/components/ds/Appear';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useTabBarTop } from '@/components/nav/WebTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { Show } from '@/lib/libraryFilters';

type Filter = { value: Show; label: string };

/** A phone's Library filters (lib-filters-proposal, decided 22 Oct 2026): four out front, the rest in the filter button's menu. */
export interface FilterSet {
  front: Filter[];
  more: { title: string; filters: Filter[] }[];
  show: Show;
  count: (value: Show) => number;
  onPick: (value: Show) => void;
  /** Every view is empty (a new venue's Library): nothing to filter. */
  nothing?: boolean;
}

/** The chips out front. A view picked from the menu goes first, with an × back to All. */
function chips({ front, more, show, count, onPick }: FilterSet, ds: Ds) {
  const picked = more.flatMap((s) => s.filters).find((f) => f.value === show);
  const back = picked ? (
    <Chip
      key={picked.value}
      look="glass"
      label={picked.label}
      count={String(count(picked.value))}
      selected
      trailing={<IconSymbol name="xmark" size={11} color={ds.accentFill.text} />}
      accessibilityLabel={`${picked.label}, ${count(picked.value)}. Back to All`}
      onPress={() => onPick('all')}
    />
  ) : null;
  return [back, ...front.map((f) => <Chip key={f.value} look="glass" label={f.label} count={String(count(f.value))} selected={show === f.value} onPress={() => onPick(f.value)} />)].filter(Boolean);
}

/** The round button at the head of the dock: every other view, as a menu opening upward. Accent while one of them is picked. */
export function FilterButton({ set }: { set: FilterSet }) {
  const ds = useDs();
  const menu = usePopover();
  const button = useRef<ComponentRef<typeof View>>(null);
  if (!set.more.length) return null;
  const on = set.more.some((s) => s.filters.some((f) => f.value === set.show));
  const sections = set.more.map((s) => ({ title: s.title, items: s.filters.map((f) => ({ label: f.label, count: set.count(f.value), checked: set.show === f.value, onPress: () => set.onPick(f.value) })) }));
  return (
    <View ref={button} collapsable={false}>
      <PressableScale role="button" aria-expanded={!!menu.anchor} accessibilityLabel={on ? 'More filters, one is on' : 'More filters'} onPress={() => menu.open(button.current)} hitSlop={4}>
        <GlassSurface interactive tint={on ? ds.accentFill.fill : undefined} style={styles.circle}>
          <IconSymbol name="line.3.horizontal.decrease" size={18} color={on ? ds.accentFill.text : ds.c.ink} />
        </GlassSurface>
      </PressableScale>
      <PopoverMenu anchor={menu.anchor} label="More filters" onClose={menu.close} sections={sections} />
    </View>
  );
}

/**
 * The four filters in one glass row just above the tabs, edge to edge, the
 * filter button first (where search puts its place), over a fade the list
 * scrolls under. It never moves (lib-filters-proposal, decided 24 Oct 2026).
 */
export function FilterDock({ set }: { set: FilterSet }) {
  const ds = useDs();
  const gutter = useGutter();
  const bottom = useTabBarTop();
  // Nothing to filter: no dock over the empty Library's "Add a drink".
  if (set.nothing) return null;
  return (
    <View style={[styles.dock, { paddingBottom: bottom + space.sm }]}>
      <DockFade />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={[styles.rowChips, { paddingHorizontal: gutter }]}>
        <FilterButton set={set} />
        <GlassSurface interactive style={styles.track}>
          <View role="radiogroup" accessibilityLabel="Show" style={styles.trackChips}>
            {chips(set, ds)}
          </View>
        </GlassSurface>
      </ScrollView>
    </View>
  );
}

/** How much of the list's bottom the dock covers, over the tab bar's own inset. */
export const FILTER_DOCK = layout.minTapTarget + space.lg;

/** Scrolled past the title: a small one pins to the top, over a fade the list scrolls under. */
export function PinnedTitle() {
  const ds = useDs();
  return (
    <Appear kind="fade" duration={160} style={styles.pinned}>
      <LinearGradient pointerEvents="none" colors={[ds.c.ground, ds.c.ground, withAlpha(ds.c.ground, 0)]} locations={[0, 0.72, 1]} style={StyleSheet.absoluteFill} />
      <ScreenHeader title="Library" />
    </Appear>
  );
}

const styles = StyleSheet.create({
  circle: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  // Taps pass through the fades to the tiles under them; only the header and chips catch them.
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space.lg, pointerEvents: 'box-none' },
  row: { flexGrow: 0 },
  rowChips: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pinned: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: space.xl, pointerEvents: 'box-none' },
  // 36-point chips in a 4-point track: a 44-point target (disc-desk-browse).
  track: { padding: space.xs },
  trackChips: { flexDirection: 'row', gap: space.xs + 2 },
});
