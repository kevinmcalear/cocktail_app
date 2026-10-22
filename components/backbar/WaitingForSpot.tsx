import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import type { NamedItem, WaitingItem } from '@/lib/backBar';
import { withAlpha } from '@/lib/color';

interface WaitingForSpotProps {
  items: WaitingItem[];
  /** The item picked up to place, if any. */
  selectedId: string | null;
  /** Without it the list is read-only. */
  onSelect?: (item: NamedItem | null) => void;
}

/**
 * Bottles the venue stocks and ingredients its menus use that have no place
 * yet, each with why it's here ("Added from Ash Garden, just now", "Poured in
 * Low Tide"). Place it, then tap a zone on the plan: no dragging, so it works
 * with a keyboard, a screen reader and wet hands.
 */
export function WaitingForSpot({ items, selectedId, onSelect }: WaitingForSpotProps) {
  const ds = useDs();
  if (!items.length) return null;
  return (
    <View style={styles.wrap}>
      <Caption tone="muted" role="heading" style={styles.eyebrow}>
        {`WAITING FOR A SPOT · ${items.length}`}
      </Caption>
      <View role="list" aria-label="Waiting for a spot">
        {items.map((item) => {
          const on = item.id === selectedId;
          return (
            <View
              key={item.id}
              role="listitem"
              style={[styles.row, { borderBottomColor: ds.c.line, backgroundColor: on ? withAlpha(ds.accentText, 0.12) : 'transparent' }]}
            >
              <View style={styles.text}>
                <Body color={on ? ds.accentText : ds.c.ink}>{item.name}</Body>
                <Caption tone="muted">{item.line}</Caption>
              </View>
              {onSelect ? (
                <Button
                  label={on ? 'Cancel' : 'Place it'}
                  size="sm"
                  variant="secondary"
                  onPress={() => onSelect(on ? null : { id: item.id, name: item.name })}
                  accessibilityLabel={on ? `Stop placing ${item.name}` : `Place ${item.name}`}
                  accessibilityHint={on ? undefined : 'Then tap the zone where it lives'}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      {onSelect ? <Caption tone="muted">{selectedId ? 'Now tap the zone where it lives.' : 'Place it asks which zone: tap it on the plan.'}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  eyebrow: { letterSpacing: 1.2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: layout.minTapTarget,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1 },
});
