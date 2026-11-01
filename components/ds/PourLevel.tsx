import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { pour as POUR } from '@/constants/tokens';

/**
 * The liquid layer of a drawing, revealed from the bottom of the glass up
 * when `moving` (DrinkDrawing). The web does it in CSS (PourLevel.web.tsx),
 * so a page with a drawing doesn't load Reanimated.
 */
export function PourLevel({ moving, children }: { moving: boolean; children: ReactNode }) {
  const fill = useSharedValue(moving ? 0 : 1);
  useEffect(() => {
    if (moving) fill.set(withDelay(POUR.delay, withTiming(1, { duration: POUR.ms, easing: Easing.out(Easing.cubic) })));
  }, [moving, fill]);
  const level = useAnimatedStyle(() => ({ height: `${fill.get() * 100}%` }));
  return <Animated.View style={[styles.level, level]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  level: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
});
