import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/**
 * A page's sky, behind its scroll view and moved with the scroll, so it
 * scrolls away as before. A pull past the top (iOS's bounce) would show the
 * bare ground over it with a hard edge (Kevin, 3 Nov), and nothing drawn above
 * a view's top shows on iOS, so the gap the pull opens is filled with `cap`:
 * the sky's top edge, stretched down as far as the pull goes.
 */
export function ScrollSky({ scrollY, cap, children }: { scrollY: SharedValue<number>; cap: ReactNode; children: ReactNode }) {
  const moved = useAnimatedStyle(() => ({ transform: [{ translateY: -scrollY.get() }] }));
  const pulled = useAnimatedStyle(() => ({ height: Math.max(0, -scrollY.get()) + 1 }));
  return (
    <>
      <Animated.View style={[styles.frame, moved]}>{children}</Animated.View>
      <Animated.View style={[styles.frame, styles.cap, pulled]}>
        <View style={StyleSheet.absoluteFill}>{cap}</View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' },
  cap: { overflow: 'hidden' },
});
