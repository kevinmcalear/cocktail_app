import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { FLING } from '@/lib/firstRun';

/**
 * A swipe card's drag on phones: right is Want, left is Not for me; short
 * of FLING it springs back. `tag` shows as it goes right (the board's
 * "Want"). The web has the same drag on the web's own pointer handling
 * (SwipeDragPan.tsx, loaded lazily by SwipeDrag.web.tsx): Gesture Handler
 * there would add its own 0.9 MB copy to the web export.
 */
export function SwipeDrag({ onSwipe, tag, label, style, children }: { onSwipe: (want: boolean) => void; tag: ReactNode; label: string; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const x = useSharedValue(0);
  const settle = (want: boolean) => {
    x.set(0);
    onSwipe(want);
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onChange((e) => x.set(x.get() + e.changeX))
    .onEnd(() => {
      const at = x.get();
      if (Math.abs(at) < FLING) return x.set(withSpring(0));
      x.set(withTiming(at > 0 ? 600 : -600, { duration: 180 }, () => scheduleOnRN(settle, at > 0)));
    });
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const showTag = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, x.get() / FLING)) }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View role="img" accessibilityLabel={label} style={[style, moving]}>
        {children}
        <Animated.View aria-hidden style={showTag}>
          {tag}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
