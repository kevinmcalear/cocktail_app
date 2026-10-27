import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PressableScale, useDs } from '@/components/ds';
import { dragGripStyle } from '@/components/recipe/FormScrollContainer';
import { layout, radius, space } from '@/constants/tokens';

/** On a touch screen a drag starts after a short hold, so a swipe over the grip still scrolls. */
const HOLD_MS = Platform.OS === 'web' ? 0 : 200;
/** Half a folded row's height: the card sits with its middle under the finger. */
const HALF_CARD = 28;
/** The held card's lean: a little at rest, up to MAX_LEAN degrees the way it moves (degrees per point a second). */
const REST_LEAN = 1.2;
const MAX_LEAN = 7;
const LEAN_PER_SPEED = 0.03;

/**
 * A row that can be dragged by its grip: it follows the finger, lifted
 * over the others, and lands where it's let go (lib/dropIndex). Plain
 * transforms, no layout animations: those crash Reanimated 4 when the
 * builder closes (as in #298). No list of its own, so it works inside any
 * ScrollView and inside a native Modal (the prep builder). `onMove` follows
 * the drag, for holding a row over another to batch them.
 *
 * `fold`: the row folds to a short card while it's dragged (a spec line to
 * its name), so the rows under it show. Its place keeps its height, the card
 * sits under the finger, and the drag is measured from the card's middle. On
 * a phone a hold anywhere on the row picks it up, not just the grip (Kevin, 27 Oct).
 * The card leans the way it moves and settles when it stops, and lies `flat`
 * once letting go would combine; no lean with Reduce Motion (drag options 2C).
 *
 * `shift`: while another row is held, how far this one slides aside to show
 * where that one lands (drag options 3B); null when nothing is held, so it
 * settles at once into its new place.
 */
export function DragRow({ index, onDrop, onMove, onHeight, fold, shift = null, flat, children }: { index: number; onDrop: (from: number, dy: number) => void; onMove?: (from: number, dy: number) => void; onHeight: (h: number) => void; fold?: boolean; shift?: number | null; flat?: boolean; children: (grip: (node: ReactNode) => ReactNode, active: boolean) => ReactNode }) {
  const y = useSharedValue(0);
  const lifted = useSharedValue(0);
  // The card grows a little as it's picked up; `lifted` itself switches at once, for its place and its layer.
  const pop = useSharedValue(0);
  const lean = useSharedValue(0);
  const level = useSharedValue(false);
  const reduce = useReducedMotion();
  const sway = !!fold && !reduce;
  // Where the finger or mouse went down: on the web the pan counts from when it activates, after it has already moved (memory: cocktail-local-testing).
  const from = useSharedValue(0);
  // Where on the row it was held, and the row's height, for where the folded card sits.
  const grab = useSharedValue(0);
  const rowHeight = useSharedValue(0);
  const [active, setActive] = useState(false);
  const [height, setHeight] = useState(0);
  const whole = !!fold && Platform.OS !== 'web';
  useEffect(() => {
    level.set(!!flat);
    if (flat) lean.set(withSpring(0));
  }, [flat, level, lean]);
  const lift = () => {
    'worklet';
    return fold ? Math.min(Math.max(0, grab.get() - HALF_CARD), Math.max(0, rowHeight.get() - 2 * HALF_CARD)) : 0;
  };
  // The card's middle, not the whole row's: it lands, and combines, where the card is.
  const moved = (absoluteY: number) => {
    'worklet';
    return absoluteY - from.get() + (fold ? lift() + HALF_CARD - rowHeight.get() / 2 : 0);
  };
  const pan = Gesture.Pan()
    .activateAfterLongPress(HOLD_MS)
    .onBegin((e) => {
      from.set(e.absoluteY);
      grab.set(e.y);
    })
    .onStart(() => {
      lifted.set(1);
      pop.set(withTiming(1, { duration: 120 }));
      if (sway) lean.set(withSpring(REST_LEAN));
      scheduleOnRN(setActive, true);
      if (whole) scheduleOnRN(Haptics.selectionAsync);
    })
    .onUpdate((e) => {
      y.set(e.absoluteY - from.get());
      // Leans into the move, then back to its rest when the finger stops (no more updates come).
      if (sway && !level.get()) lean.set(withSequence(withSpring(Math.max(-MAX_LEAN, Math.min(MAX_LEAN, REST_LEAN + e.velocityY * LEAN_PER_SPEED))), withSpring(REST_LEAN)));
      if (onMove) scheduleOnRN(onMove, index, moved(e.absoluteY));
    })
    .onEnd((e) => {
      scheduleOnRN(onDrop, index, moved(e.absoluteY));
    })
    .onFinalize(() => {
      y.set(0);
      lifted.set(0);
      pop.set(0);
      lean.set(0);
      scheduleOnRN(setActive, false);
    });
  const follow = useAnimatedStyle(() => ({
    zIndex: lifted.get() ? 1 : 0,
    transform: [
      { translateY: y.get() + (lifted.get() ? lift() : 0) },
      { translateY: shift === null ? 0 : withTiming(shift, { duration: 200 }) },
      { rotate: `${lean.get()}deg` },
      { scale: fold ? 1 + 0.03 * pop.get() : 1 },
    ],
  }));
  const row = (
    <Animated.View
      style={[follow, fold && active && height ? { height } : null]}
      onLayout={(e) => {
        // Folded, the place keeps the row's height: the other rows stay put and the drop sums stay right.
        if (fold && active) return;
        const h = e.nativeEvent.layout.height;
        setHeight(h);
        rowHeight.set(h);
        onHeight(h);
      }}
    >
      {/* The detector holds a plain View, not the grip itself: on the web Gesture Handler won't capture the pointer for a role="button" view, so a mouse drag stopped once it left the grip. */}
      {children((node) => (whole ? node : <GestureDetector gesture={pan}><View>{node}</View></GestureDetector>), active)}
    </Animated.View>
  );
  return whole ? <GestureDetector gesture={pan}>{row}</GestureDetector> : row;
}

/** A line's grip: hold it and drag to move the line; the arrow keys and a screen reader's actions move it one place. */
export function LineGrip({ name, onMove }: { name: string; onMove?: (by: -1 | 1) => void }) {
  return (
    <PressableScale
      role="button"
      accessibilityLabel={`Reorder ${name}`}
      accessibilityHint={Platform.OS === 'web' ? 'Drag, or use the arrow keys' : 'Hold and drag'}
      accessibilityActions={[
        { name: 'up', label: 'Move up' },
        { name: 'down', label: 'Move down' },
      ]}
      onAccessibilityAction={(e) => onMove?.(e.nativeEvent.actionName === 'up' ? -1 : 1)}
      // @ts-expect-error onKeyDown is web-only (react-native-web)
      onKeyDown={(e: { key: string; preventDefault: () => void }) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        onMove?.(e.key === 'ArrowUp' ? -1 : 1);
      }}
      haptic={false}
      style={[styles.grip, dragGripStyle]}
    >
      <GripDots />
    </PressableScale>
  );
}

/** A grip's six dots. */
export function GripDots() {
  const ds = useDs();
  return (
    <View style={styles.dots}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.dot, { backgroundColor: ds.c.muted }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Narrow, so the name keeps its room on a phone; the hold, not its size, keeps a swipe over it scrolling.
  grip: { width: space.xl, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center', marginRight: -space.xs },
  dots: { width: 7, flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  dot: { width: 2.5, height: 2.5, borderRadius: radius.pill },
});
