import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { ShoppingRow } from '@/lib/shoppingList';

/** The big round tick, 44 square to hit in an aisle. */
function Tick({ row, on, label, onToggle }: { row: ShoppingRow; on: boolean; label: string; onToggle: (row: ShoppingRow, got: boolean) => void }) {
  const ds = useDs();
  return (
    <PressableScale role="checkbox" aria-checked={on} accessibilityLabel={label} onPress={() => onToggle(row, !on)} style={styles.tickHit}>
      <View style={[styles.tick, on ? { backgroundColor: ds.accentFill.fill, borderColor: ds.accentFill.fill } : { borderColor: withAlpha(ds.c.ink, 0.4) }]}>
        {on ? <IconSymbol name="checkmark" size={14} color={ds.accentFill.text} /> : null}
      </View>
    </PressableScale>
  );
}

/** A thing to get: the tick, its drawing, its name and why it's on the list (shopping B2). */
export function ShoppingItemRow({ row, why, onToggle, onRemove }: { row: ShoppingRow; why: string; onToggle: (row: ShoppingRow, got: boolean) => void; onRemove: (row: ShoppingRow) => void }) {
  const ds = useDs();
  const low = row.source === 'running_low';
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <Tick row={row} on={false} label={`Got ${row.name}`} onToggle={onToggle} />
      <IngredientThumb id={row.itemId} name={row.name} size={44} />
      <View style={styles.text}>
        <DsText variant="headline" numberOfLines={2}>
          {row.name}
        </DsText>
        <Caption tone="muted" numberOfLines={2}>
          {why}
        </Caption>
        {/* Under the name, not beside it: a phone row has no room for both. */}
        {low ? (
          <View style={[styles.pill, { borderColor: withAlpha(ds.accentText, 0.45) }]}>
            <Caption color={ds.accentText}>On your shelf</Caption>
          </View>
        ) : null}
      </View>
      <PressableScale accessibilityLabel={`Take ${row.name} off the list`} onPress={() => onRemove(row)} style={styles.remove}>
        <IconSymbol name="xmark" size={14} color={ds.c.faint} />
      </PressableScale>
    </View>
  );
}

/** A ticked thing under Got it: crossed out, with what ticking it did. Untick puts it back. */
export function GotRow({ row, done, onToggle }: { row: ShoppingRow; done: string; onToggle: (row: ShoppingRow, got: boolean) => void }) {
  const ds = useDs();
  return (
    <View style={[styles.row, styles.got, { borderBottomColor: ds.c.line }]}>
      <Tick row={row} on label={`Got ${row.name}. Untick to put it back on the list`} onToggle={onToggle} />
      <IngredientThumb id={row.itemId} name={row.name} size={36} />
      <View style={styles.text}>
        <Body tone="muted" numberOfLines={1} style={styles.crossed}>
          {row.name}
        </Body>
        <Caption tone="muted" numberOfLines={1}>
          {done}
        </Caption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 68, borderBottomWidth: StyleSheet.hairlineWidth },
  got: { minHeight: 60 },
  tickHit: { width: layout.minTapTarget, height: layout.minTapTarget, marginLeft: -space.sm, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 26, height: 26, borderRadius: radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 1 },
  crossed: { textDecorationLine: 'line-through' },
  pill: { alignSelf: 'flex-start', marginTop: space.xs, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  remove: { width: layout.minTapTarget, height: layout.minTapTarget, marginRight: -space.sm, alignItems: 'center', justifyContent: 'center' },
});
