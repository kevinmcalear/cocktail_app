import { useMemo, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { FLING } from '@/lib/firstRun';

/**
 * The web's swipe card drag (SwipeDrag.web.tsx loads it): the phones' drag
 * (SwipeDrag.tsx) on React Native's own PanResponder and Animated, which the
 * web export already carries, so it adds a few KB, not a copy of Gesture
 * Handler. Mouse or touch: right is Want, left is Not for me; short of FLING
 * it springs back, and `tag` shows as it goes right.
 */
export function SwipeDragPan({ onSwipe, tag, label, style, children }: { onSwipe: (want: boolean) => void; tag: ReactNode; label: string; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const [x] = useState(() => new Animated.Value(0));
  const pan = useMemo(() => {
    const home = () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => x.setValue(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) < FLING) return home();
        Animated.timing(x, { toValue: g.dx > 0 ? 600 : -600, duration: 180, useNativeDriver: false }).start(() => {
          x.setValue(0);
          onSwipe(g.dx > 0);
        });
      },
      onPanResponderTerminate: home,
    });
  }, [x, onSwipe]);
  const showTag = x.interpolate({ inputRange: [0, FLING], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <Animated.View role="img" accessibilityLabel={label} style={[style, styles.grab, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
      {/* The card's insides take no pointer, so a press on its drawing drags the card, not the picture. */}
      <View style={styles.inside}>{children}</View>
      <Animated.View aria-hidden style={{ opacity: showTag }}>
        {tag}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // A drag, not a text selection.
  grab: { cursor: 'grab', userSelect: 'none' },
  inside: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' },
});
