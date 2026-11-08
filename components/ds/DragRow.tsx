import * as Haptics from 'expo-haptics';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { layout, lift as LIFT, radius, space } from '@/constants/tokens';

import { useDragScroll } from './dragScroll';
import { useDs } from './theme';

/** On a touch screen a drag starts after a short hold, so a swipe over the grip still scrolls. */
const HOLD_MS = Platform.OS === 'web' ? 0 : LIFT.holdMs;
/** Half a folded row's height: the card sits with its middle under the finger. */
const HALF_CARD = 28;
/** A grip is drawn narrow (space.xl), so the row keeps its room; this much either side makes its hold 44 wide. */
export const GRIP_SLOP = (layout.minTapTarget - space.xl) / 2;

export interface DragRowProps {
  index: number;
  /** Let go, `d` points from where it was picked up (its card's middle, folded), once it has eased into its slot. */
  onDrop: (from: number, d: number) => void;
  /** Follows the drag, for where it would land (lib/dropIndex dragSlot) and holding one row over another to combine; returns how far its slot is from its place, where it eases when let go. */
  onMove?: (from: number, d: number) => number | void;
  /** Picked up, then taken away before it was let go (Android's back swipe, a system gesture): the others go back to their places. */
  onCancel?: (from: number) => void;
  onHeight: (size: number) => void;
  /** Folds to a short card while held (a spec line, to its name); on a phone a hold anywhere on the row picks it up. */
  fold?: boolean;
  /** While another row is held, how far this one slides aside to show where that one lands; null when nothing is. */
  shift?: number | null;
  /** Lies flat, without its lean: letting go would combine it. It doesn't ease to a slot either. */
  flat?: boolean;
  /** Lifted, the row becomes a card of its own (raised, a line round it, the lift shadow). A spec line draws its own (useHeldStyle). */
  card?: boolean;
  axis?: 'x' | 'y';
  children: (grip: (node: ReactNode) => ReactNode, active: boolean) => ReactNode;
}

/**
 * A row that can be dragged by its grip (Add-drag; drag options 1B, 2C, 3B):
 * held, it lifts (the lift token: a little bigger, leaning the way it moves,
 * on a shadow); the others ease aside (`shift`); near the scroller's edge
 * (a DragScrollView) the page scrolls with it; let go, it eases into its
 * slot (what `onMove` returns) and is put down. Plain transforms, no layout animations:
 * those crash Reanimated 4 when a builder closes (#298). No list of its own,
 * so it works inside any ScrollView and inside a native Modal (with its own
 * GestureRoot). Most lists use DragList, which does the sums.
 */
export function DragRow({ index, onDrop, onMove, onCancel, onHeight, fold, shift = null, flat, card, axis = 'y', children }: DragRowProps) {
  const ds = useDs();
  const x = axis === 'x';
  const scroll = useDragScroll();
  // How far the finger has moved since the pick-up, then the ease into the slot.
  const finger = useSharedValue(0);
  const lifted = useSharedValue(0);
  // The card grows a little as it's picked up; `lifted` itself switches at once, for its place and its layer.
  const pop = useSharedValue(0);
  const lean = useSharedValue(0);
  const level = useSharedValue(false);
  const landing = useSharedValue(false);
  const reduce = useReducedMotion();
  // Where the finger or mouse went down: on the web the pan counts from when it activates, after it has already moved.
  const from = useSharedValue(0);
  // Where on the row it was held, and the row's height, for where the folded card sits.
  const grab = useSharedValue(0);
  const rowHeight = useSharedValue(0);
  const [active, setActive] = useState(false);
  const [height, setHeight] = useState(0);
  const whole = !!fold && Platform.OS !== 'web';
  // The last move, without the scroll it rode: a scroll alone moves it too.
  const last = useSharedValue(0);
  useEffect(() => {
    level.set(!!flat);
    if (flat) lean.set(withSpring(0));
  }, [flat, level, lean]);
  // Put down: once the list has its new order (this render), it rests in its new place.
  useLayoutEffect(() => {
    if (active || !landing.get()) return;
    finger.set(0);
    lifted.set(0);
    pop.set(0);
    lean.set(0);
    landing.set(false);
  });
  const lift = () => {
    'worklet';
    return fold ? Math.min(Math.max(0, grab.get() - HALF_CARD), Math.max(0, rowHeight.get() - 2 * HALF_CARD)) : 0;
  };
  // The card's middle, not the whole row's: it lands, and combines, where the card is.
  const adjust = () => {
    'worklet';
    return fold ? lift() + HALF_CARD - rowHeight.get() / 2 : 0;
  };
  const rode = () => {
    'worklet';
    return scroll ? scroll.delta.get() : 0;
  };
  const track = (d: number) => onMove?.(index, d);
  const begin = () => {
    setActive(true);
    scroll?.begin((rodeBy) => onMove?.(index, last.get() + rodeBy));
  };
  const end = () => {
    scroll?.end();
    setActive(false);
  };
  const cancel = () => {
    onCancel?.(index);
    end();
  };
  const drop = (d: number) => {
    onDrop(index, d);
    end();
  };
  // Let go: where it lands is from the last move (an update may not have come for it), and it eases there first, its own place too.
  const release = (d: number) => {
    const land = onMove?.(index, d) ?? 0;
    finger.set(withTiming(land, { duration: LIFT.ms.land }, () => scheduleOnRN(drop, d)));
  };
  const tick = () => void Haptics.selectionAsync();
  const pan = Gesture.Pan()
    .activateAfterLongPress(HOLD_MS)
    .hitSlop(whole ? undefined : { horizontal: GRIP_SLOP })
    .onBegin((e) => {
      from.set(x ? e.absoluteX : e.absoluteY);
      grab.set(e.y);
    })
    .onStart((e) => {
      lifted.set(1);
      landing.set(false);
      pop.set(withTiming(1, { duration: LIFT.ms.pick }));
      if (!reduce && !level.get()) lean.set(withSpring(LIFT.lean.rest));
      if (scroll) {
        scroll.start.set(scroll.offset.get());
        scroll.delta.set(0);
        // Where the finger is now: a held finger sends no updates, and the last drag's place would scroll the page.
        scroll.pointer.set(x ? e.absoluteX : e.absoluteY);
        scroll.held.set(true);
      }
      scheduleOnRN(begin);
      if (Platform.OS !== 'web') scheduleOnRN(tick);
    })
    .onUpdate((e) => {
      const at = x ? e.absoluteX : e.absoluteY;
      finger.set(at - from.get());
      if (scroll) scroll.pointer.set(at);
      // Leans into the move, then back to its rest when the finger stops (no more updates come).
      if (!reduce && !level.get()) lean.set(withSequence(withSpring(Math.max(-LIFT.lean.max, Math.min(LIFT.lean.max, LIFT.lean.rest + (x ? e.velocityX : e.velocityY) * LIFT.lean.perSpeed))), withSpring(LIFT.lean.rest)));
      last.set(at - from.get() + adjust());
      scheduleOnRN(track, last.get() + rode());
    })
    .onEnd((e) => {
      const d = (x ? e.absoluteX : e.absoluteY) - from.get() + adjust() + rode();
      landing.set(true);
      // The scroll it rode becomes where it is, and the scroller lets go.
      if (scroll) {
        finger.set(finger.get() + scroll.delta.get());
        scroll.delta.set(0);
        scroll.held.set(false);
      }
      // Let go over a line it combines with, it's put down there.
      scheduleOnRN(flat ? drop : release, d);
    })
    .onFinalize(() => {
      if (landing.get()) return;
      // Cancelled (another gesture took it, or the row went away): back to its place.
      finger.set(0);
      lifted.set(0);
      pop.set(0);
      lean.set(0);
      if (scroll) {
        scroll.delta.set(0);
        scroll.held.set(false);
      }
      scheduleOnRN(cancel);
    });
  const follow = useAnimatedStyle(() => {
    const along = finger.get() + (lifted.get() ? rode() + lift() : 0);
    const aside = shift === null ? 0 : withTiming(shift, { duration: LIFT.ms.slide });
    return {
      zIndex: lifted.get() ? 1 : 0,
      transform: [x ? { translateX: along } : { translateY: along }, x ? { translateX: aside } : { translateY: aside }, { rotate: `${lean.get()}deg` }, { scale: 1 + (LIFT.scale - 1) * pop.get() }],
    };
  });
  const row = (
    <Animated.View
      style={[follow, fold && active && height ? { height } : null, card && active ? [styles.card, LIFT.shadow, { backgroundColor: ds.c.raised }] : null]}
      onLayout={(e) => {
        // Folded, the place keeps the row's height: the other rows stay put and the drop sums stay right.
        if (fold && active) return;
        const h = x ? e.nativeEvent.layout.width : e.nativeEvent.layout.height;
        setHeight(h);
        rowHeight.set(h);
        onHeight(h);
      }}
    >
      {/* The detector holds a plain View, not the grip itself: on the web Gesture Handler won't capture the pointer for a role="button" view, so a mouse drag stopped once it left the grip. */}
      {children((node) => (whole ? node : <GestureDetector gesture={pan}><View>{node}</View></GestureDetector>), active)}
      {card && active ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.card, styles.edge, { borderColor: ds.c.lineStrong }]} /> : null}
    </Animated.View>
  );
  return whole ? <GestureDetector gesture={pan}>{row}</GestureDetector> : row;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.control },
  edge: { borderWidth: LIFT.border },
});
