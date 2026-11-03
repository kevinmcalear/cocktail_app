import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

/**
 * Phones: a sideways swipe across a drink page goes to the next drink on the
 * menu or the one before. Up and down still scroll the page, and the hero's
 * own photo pager keeps its swipes. (The web pages with the arrow keys
 * instead, see PagerSwipe.web.tsx.)
 */
export function PagerSwipe({ enabled, onNext, onPrev, children }: { enabled: boolean; onNext: () => void; onPrev: () => void; children: ReactNode }) {
  const swipe = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-28, 28])
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      if (e.translationX < -60) runOnJS(onNext)();
      else if (e.translationX > 60) runOnJS(onPrev)();
    });
  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
