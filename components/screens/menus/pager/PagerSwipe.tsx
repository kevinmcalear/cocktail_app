import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { useMenuPagerNav } from '@/hooks/useMenuPager';

// The iOS back swipe starts at the left edge: leave it to Back, which returns to the menu.
const EDGE = 30;

/**
 * Phones: a sideways swipe across a drink page opened from a menu goes to the
 * next drink on it or the one before (Menu-in-draw). Up and down still
 * scroll the page. (The web pages with the arrow keys, PagerSwipe.web.tsx.)
 */
export function PagerSwipe({ menuId, bar, itemId, children }: { menuId: string; bar: string | null; itemId: string; children: ReactNode }) {
  const { place, go } = useMenuPagerNav(menuId, bar, itemId);
  const next = () => go(place?.next);
  const prev = () => go(place?.prev);
  const swipe = Gesture.Pan()
    .enabled(!!place)
    .hitSlop({ left: -EDGE })
    .activeOffsetX([-28, 28])
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      if (e.translationX < -60) runOnJS(next)();
      else if (e.translationX > 60) runOnJS(prev)();
    });
  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
