import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { pulse as PULSE } from '@/constants/tokens';

/** A view that gently pulses while something loads, or holds still with Reduce Motion. The web does it in CSS (Pulse.web.tsx). */
export function Pulse({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(PULSE.low, { duration: PULSE.ms }), -1, true);
  }, [reduceMotion, opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View aria-hidden style={[style, pulse]} />;
}
