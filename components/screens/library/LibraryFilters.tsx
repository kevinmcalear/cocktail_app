import { LinearGradient } from 'expo-linear-gradient';
import { useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, GlassSurface, PopoverMenu, PressableScale, useDs, usePopover, type Ds } from '@/components/ds';
import { Appear } from '@/components/ds/Appear';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { Show } from '@/lib/libraryFilters';

import { FilterRow } from './LibraryChips';

type Filter = { value: Show; label: string };

/** A phone's Library filters (lib-filters-proposal, decided 22 Oct 2026): four out front, the rest in the filter button's menu. */
export interface FilterSet {
  front: Filter[];
  more: { title: string; filters: Filter[] }[];
  show: Show;
  count: (value: Show) => number;
  onPick: (value: Show) => void;
}

/** The chips out front. A view picked from the menu goes first, with an × back to All. */
function chips({ front, more, show, count, onPick }: FilterSet, look: 'outline' | 'glass', ds: Ds) {
  const picked = more.flatMap((s) => s.filters).find((f) => f.value === show);
  const back = picked ? (
    <Chip
      key={picked.value}
      look={look}
      label={picked.label}
      count={String(count(picked.value))}
      selected
      trailing={<IconSymbol name="xmark" size={11} color={ds.accentFill.text} />}
      accessibilityLabel={`${picked.label}, ${count(picked.value)}. Back to All`}
      onPress={() => onPick('all')}
    />
  ) : null;
  return [back, ...front.map((f) => <Chip key={f.value} look={look} label={f.label} count={String(count(f.value))} selected={show === f.value} onPress={() => onPick(f.value)} />)].filter(Boolean);
}

/** The row in the page: outlined chips, scrolling sideways edge to edge. */
export function PhoneFilterRow({ set, gutter }: { set: FilterSet; gutter: number }) {
  const ds = useDs();
  return <FilterRow label="Show" gutter={gutter} groups={[chips(set, 'outline', ds)]} />;
}

/** The round button beside New: every other view, as a menu. Accent while one of them is picked. */
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
 * Scrolled past the filters: the header row and the filters pin to the top,
 * the filters in one glass track, over a fade the list scrolls under. Glass
 * only here, where they float; in the page they're plain outlined chips.
 */
export function PinnedFilters({ set, gutter }: { set: FilterSet; gutter: number }) {
  const ds = useDs();
  return (
    <Appear kind="fade" duration={160} style={styles.pinned}>
      <LinearGradient pointerEvents="none" colors={[ds.c.ground, withAlpha(ds.c.ground, 0.85), withAlpha(ds.c.ground, 0)]} locations={[0, 0.7, 1]} style={StyleSheet.absoluteFill} />
      <ScreenHeader title="Library" actions={<FilterButton set={set} />} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter }}>
        <GlassSurface interactive style={styles.track}>
          <View role="radiogroup" accessibilityLabel="Show" style={styles.trackChips}>
            {chips(set, 'glass', ds)}
          </View>
        </GlassSurface>
      </ScrollView>
    </Appear>
  );
}

const styles = StyleSheet.create({
  circle: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  // Taps pass through the fade to the tiles under it; only the header and chips catch them.
  pinned: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: space.xl, pointerEvents: 'box-none' },
  // 36-point chips in a 4-point track: a 44-point target (disc-desk-browse).
  track: { padding: space.xs },
  trackChips: { flexDirection: 'row', gap: space.xs + 2 },
});
