import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { pulse as PULSE } from '@/constants/tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import { webMotion } from './webMotion';

// Keyframes only work from StyleSheet.create (react-native-web compiles them to a class).
const styles = StyleSheet.create({
  breathe: webMotion({
    animationKeyframes: { from: { opacity: 1 }, to: { opacity: PULSE.low } },
    animationDuration: `${PULSE.ms}ms`,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
  }),
});

/** The web's Pulse: a CSS keyframe, no Reanimated. */
export function Pulse({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  return <View aria-hidden style={[style, !reduceMotion && styles.breathe]} />;
}
