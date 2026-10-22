import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useDs } from '@/components/ds';
import { radius } from '@/constants/tokens';

/** On a touch screen a drag starts after a short hold, so a swipe over the grip still scrolls. */
const HOLD_MS = Platform.OS === 'web' ? 0 : 200;

/**
 * A row that can be dragged by its grip: it follows the finger, lifted
 * over the others, and lands where it's let go (lib/dropIndex). Plain
 * transforms, no layout animations: those crash Reanimated 4 when the
 * builder closes (as in #298). No list of its own, so it works inside any
 * ScrollView and inside a native Modal (the prep builder).
 */
export function DragRow({ index, onDrop, onHeight, children }: { index: number; onDrop: (from: number, dy: number) => void; onHeight: (h: number) => void; children: (grip: (node: ReactNode) => ReactNode, active: boolean) => ReactNode }) {
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
  dots: { width: 7, flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  dot: { width: 2.5, height: 2.5, borderRadius: radius.pill },
});
