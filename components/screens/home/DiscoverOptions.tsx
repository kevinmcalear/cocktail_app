import { useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PopoverMenu, useDs, usePopover } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';

import type { MapLayer } from './DiscoverControls';
import { GlassChip } from './StyleChips';

export interface SortOption {
  value: MapLayer;
  label: string;
}

/**
 * The orders on offer (disc-map-browse, approved 24 Oct). A style picked: Best
 * first, or Nearest. Searching: Best match, Top rated when the search names a
 * drink, or Nearest. Nearest needs somewhere to count from.
 */
export function sortOptions({ searching, best, nearest }: { searching: boolean; best: boolean; nearest: boolean }): SortOption[] {
  const out: SortOption[] = searching ? [{ value: 'drinks', label: 'Best match' }] : [{ value: 'best', label: 'Best first' }];
  if (searching && best) out.push({ value: 'best', label: 'Top rated' });
  if (nearest) out.push({ value: 'nearest', label: 'Nearest' });
  return out;
}

/** A toggle in the row: on or off, and what it does. */
interface Toggle {
  on: boolean;
  onChange: (on: boolean) => void;
}

interface OptionChipsProps {
  sort: { value: MapLayer; options: SortOption[]; onChange: (value: MapLayer) => void };
  /** Signed in only. */
  notHad?: Toggle;
  past: Toggle;
  /** Phones: one sideways row over the map. Else they wrap in the list, glass as the Filters chip beside them. */
  onGlass?: boolean;
}

/**
 * What the drink chips turn into once one is picked, or while searching, as
 * Google Maps swaps its categories for a search's own options: the order (a
 * menu), Not had yet and Past menus. The last two are the Filters sheet's own
 * switches, here so they're a tap away.
 */
export function OptionChips({ sort, notHad, past, onGlass }: OptionChipsProps) {
  const ds = useDs();
  const menu = usePopover();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const current = sort.options.find((o) => o.value === sort.value) ?? sort.options[0];
  const chevron = <IconSymbol name="chevron.down" size={11} color={ds.c.ink} />;
  const a11y = `Order: ${current.label}. Change`;
  const open = () => menu.open(anchor.current);
  const toggles = [
    notHad ? { key: 'had', label: 'Not had yet', ...notHad } : null,
    { key: 'past', label: 'Past menus', ...past },
  ].filter((t) => t !== null);
  const chips = (
    <>
      {sort.options.length > 1 ? (
        <View ref={anchor} collapsable={false}>
          <GlassChip role="button" label={current.label} trailing={chevron} accessibilityLabel={a11y} onPress={open} />
        </View>
      ) : null}
      {toggles.map((t) => (
        <GlassChip key={t.key} label={t.label} on={t.on} onPress={() => t.onChange(!t.on)} />
      ))}
      <PopoverMenu
        anchor={menu.anchor}
        label="Order"
        onClose={menu.close}
        sections={[{ items: sort.options.map((o) => ({ label: o.label, checked: o.value === current.value, onPress: () => sort.onChange(o.value) })) }]}
      />
    </>
  );
  if (!onGlass) {
    return (
      <View role="group" accessibilityLabel="Options" style={styles.wrap}>
        {chips}
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" role="group" accessibilityLabel="Options" style={styles.edge} contentContainerStyle={styles.row}>
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // Runs to the screen's edges over the map, as the drink chips do.
  edge: { marginHorizontal: -space.lg, flexGrow: 0 },
  row: { gap: space.sm, paddingHorizontal: space.lg },
});
