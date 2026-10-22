import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PressableScale, useDs } from '@/components/ds';
import { dragGripStyle } from '@/components/recipe/FormScrollContainer';
import { layout, radius, space } from '@/constants/tokens';

/** On a touch screen a drag starts after a short hold, so a swipe over the grip still scrolls. */
const HOLD_MS = Platform.OS === 'web' ? 0 : 200;

/**
 * A row that can be dragged by its grip: it follows the finger, lifted
 * over the others, and lands where it's let go (lib/dropIndex). Plain
 * transforms, no layout animations: those crash Reanimated 4 when the
 * builder closes (as in #298). No list of its own, so it works inside any
 * ScrollView and inside a native Modal (the prep builder). `onMove` follows
 * the drag, for holding a row over another to batch them.
 */
export function DragRow({ index, onDrop, onMove, onHeight, children }: { index: number; onDrop: (from: number, dy: number) => void; onMove?: (from: number, dy: number) => void; onHeight: (h: number) => void; children: (grip: (node: ReactNode) => ReactNode, active: boolean) => ReactNode }) {
  const y = useSharedValue(0);
  const lifted = useSharedValue(0);
  const [active, setActive] = useState(false);
  const pan = Gesture.Pan()
    .activateAfterLongPress(HOLD_MS)
    .onStart(() => {
      lifted.set(1);
      scheduleOnRN(setActive, true);
    })
    .onUpdate((e) => {
      y.set(e.translationY);
      if (onMove) scheduleOnRN(onMove, index, e.translationY);
    })
    .onEnd((e) => {
      scheduleOnRN(onDrop, index, e.translationY);
    })
    .onFinalize(() => {
      y.set(0);
      lifted.set(0);
      scheduleOnRN(setActive, false);
    });
  const follow = useAnimatedStyle(() => ({ zIndex: lifted.get() ? 1 : 0, transform: [{ translateY: y.get() }] }));
  return (
    <Animated.View style={follow} onLayout={(e) => onHeight(e.nativeEvent.layout.height)}>
      {children((node) => <GestureDetector gesture={pan}>{node}</GestureDetector>, active)}
    </Animated.View>
  );
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
