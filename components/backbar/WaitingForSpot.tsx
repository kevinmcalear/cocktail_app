import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';
import type { NamedItem } from '@/lib/backBar';
import { withAlpha } from '@/lib/color';

import { selectedProps } from './BackBarPlan';

interface WaitingForSpotProps {
  items: NamedItem[];
  /** The item picked up to place, if any. */
  selectedId: string | null;
  /** Without it the list is read-only. */
  onSelect?: (item: NamedItem | null) => void;
}

/**
 * Ingredients the current menus use that have no place yet. Placing one is
 * select, then tap a zone on the plan: no dragging, so it works with a
 * keyboard, a screen reader and wet hands.
 */
export function WaitingForSpot({ items, selectedId, onSelect }: WaitingForSpotProps) {
  const ds = useDs();
  if (!items.length) return null;
  return (
    <View style={styles.wrap}>
      <Caption tone="muted" role="heading" style={styles.eyebrow}>
        WAITING FOR A SPOT
      </Caption>
      <View style={styles.chips}>
        {items.map((item) => {
          const on = item.id === selectedId;
          const look = [
            styles.chip,
            {
              borderColor: on ? ds.accentText : ds.c.lineStrong,
              backgroundColor: on ? withAlpha(ds.accentText, 0.16) : 'transparent',
            },
          ];
          return onSelect ? (
            <PressableScale
              key={item.id}
              onPress={() => onSelect(on ? null : item)}
              accessibilityLabel={item.name}
              accessibilityHint={on ? 'Tap a zone on the plan to place it there' : 'Picks it up to place on the plan'}
              {...selectedProps(on)}
              style={look}
            >
              <Body color={on ? ds.accentText : ds.c.ink}>{item.name}</Body>
            </PressableScale>
          ) : (
            <View key={item.id} style={look}>
              <Body>{item.name}</Body>
            </View>
          );
        })}
      </View>
      {onSelect ? (
        <Caption tone="muted">{selectedId ? 'Now tap the zone where it lives.' : 'Pick one, then tap the zone where it lives.'}</Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  eyebrow: { letterSpacing: 1.2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: layout.minTapTarget,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderCurve: 'continuous',
  },
});
