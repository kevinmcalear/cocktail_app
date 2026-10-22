import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { NamedItem, WaitingItem } from '@/lib/backBar';

interface WaitingForSpotProps {
  items: WaitingItem[];
  /** The item picked up to place, if any. */
  selectedId: string | null;
  /** Without it the list is read-only. */
  onSelect?: (item: NamedItem | null) => void;
}

/**
 * What has no place at the venue yet: bottles put on the back bar from a
 * drink's line, then what the menus pour. Place it is pick up, then tap a
 * zone on the plan: no dragging, so it works with a keyboard, a screen
 * reader and wet hands.
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
            <View key={item.id} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
              <View style={styles.flex}>
                <Body color={on ? ds.accentText : ds.c.ink}>{item.name}</Body>
                <Caption tone="muted">{item.detail}</Caption>
              </View>
              {onSelect ? (
                <Button
                  label="Place it"
                  variant="secondary"
                  size="sm"
                  onPress={() => onSelect(on ? null : { id: item.id, name: item.name })}
                  accessibilityLabel={`Place ${item.name}`}
                  accessibilityHint={on ? 'Picked up: tap a zone on the plan to place it there' : 'Picks it up to place on the plan'}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      {onSelect && selectedId ? <Caption tone="muted">Now tap the zone where it lives.</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  eyebrow: { letterSpacing: 1.2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
});
