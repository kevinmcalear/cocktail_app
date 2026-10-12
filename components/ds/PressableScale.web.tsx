import { Pressable } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';

import type { PressableScaleProps } from './PressableScale';
import { EASE_OUT, webMotion } from './webMotion';

const SQUEEZE = webMotion({ transitionProperty: 'transform', transitionDuration: '120ms', transitionTimingFunction: EASE_OUT });

/**
 * The web's press: the same small squeeze as a CSS transition, so the browser
 * shows it on the tap's own frame and the web needn't load Reanimated
 * (PressableScale.tsx springs it on native, with a haptic tick).
 */
export function PressableScale({ haptic: _haptic, style, ...rest }: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  return <Pressable role="button" {...rest} style={({ pressed }) => [style, SQUEEZE, pressed && !reduceMotion && { transform: [{ scale: 0.96 }] }]} />;
}
