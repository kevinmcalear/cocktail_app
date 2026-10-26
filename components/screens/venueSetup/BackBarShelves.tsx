import { useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, IngredientDrawing, PressableScale, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

export interface ShelfBottle {
  id: string;
  name: string;
}

// A bottle stands 44 by 96 (board w2-venue-first-steps, E39 A); its drawing is a 96 square, the bottle in its middle.
const BOTTLE_W = 44;
const BOTTLE_H = 96;
const PAD = space.lg;
const GAP = space.sm;
const BOARD = 5;
const SHELF = BOTTLE_H + BOARD + space.xs;

/**
 * The back bar as it fills (Eddie E39, board w2-venue-first-steps A): shelves
 * of drawn bottles in the order they were picked, the newest at the end, and
 * dashed slots for what's still to come, so the empty shelf says what the step
 * is for. A tap takes a bottle off. Past `rows` shelves it scrolls, kept on the
 * newest.
 */
export function BackBarShelves({ name, bottles, rows, onTakeOff }: { name: string; bottles: readonly ShelfBottle[]; rows: number; onTakeOff: (bottle: ShelfBottle) => void }) {
  const ds = useDs();
  const [width, setWidth] = useState(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const perShelf = Math.max(1, Math.floor((width - 2 * PAD + GAP) / (BOTTLE_W + GAP)));
  const shelves = Math.max(1, Math.ceil(bottles.length / perShelf));
  const count = bottles.length;
  const line = count ? `${count} on your back bar · tap one to take it off` : 'Pick a bottle and it goes on the shelf';
  return (
    <View
      role="group"
      aria-label={`${name}’s back bar, ${count} ${count === 1 ? 'bottle' : 'bottles'}`}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.card, { backgroundColor: ds.c.paper }]}
    >
      {width ? (
        <ScrollView ref={scroll} style={{ maxHeight: rows * SHELF }} nestedScrollEnabled showsVerticalScrollIndicator={false} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {Array.from({ length: shelves }, (_, r) => (
            <View key={r} style={styles.shelf}>
              <View style={styles.row}>
                {Array.from({ length: perShelf }, (_, c) => {
                  const bottle = bottles[r * perShelf + c];
                  if (!bottle) return <View key={c} aria-hidden style={[styles.slot, { borderColor: withAlpha(ds.c.sketchInk, 0.25) }]} />;
                  return (
                    <PressableScale key={bottle.id} role="button" accessibilityLabel={`${bottle.name}, on your back bar. Take it off`} onPress={() => onTakeOff(bottle)} style={styles.bottle}>
                      <View style={styles.art}>
                        <IngredientDrawing id={bottle.id} name={bottle.name} detail="thumb" bare drawn />
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
              <View aria-hidden style={[styles.board, { backgroundColor: withAlpha(ds.c.sketchInk, 0.6) }]} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={{ height: SHELF }} />
      )}
      <Caption color={ds.c.sketchInk}>{line}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: PAD, paddingTop: space.md, paddingBottom: space.md, gap: space.sm },
  shelf: { marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: GAP, minHeight: BOTTLE_H },
  bottle: { width: BOTTLE_W, height: BOTTLE_H, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  art: { width: BOTTLE_H, height: BOTTLE_H },
  slot: { width: BOTTLE_W, height: 80, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed' },
  board: { height: BOARD, borderRadius: radius.mark, marginHorizontal: -space.xs },
});
