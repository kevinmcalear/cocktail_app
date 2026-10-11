import { StyleSheet, View } from 'react-native';

import type { AppearProps } from './Appear';
import { EASE_OUT, webMotion } from './webMotion';

const FADE = { from: { opacity: 0 }, to: { opacity: 1 } };
const SLIDE = { from: { transform: [{ translateY: '-100%' }] }, to: { transform: [{ translateY: '0%' }] } };

// Keyframes only work from StyleSheet.create (react-native-web compiles them to
// a class), so each kind and duration is compiled once.
const sheet = (kind: AppearProps['kind'], duration: number) =>
  StyleSheet.create({
    in: webMotion({ animationKeyframes: kind === 'fade' ? FADE : SLIDE, animationDuration: `${duration}ms`, animationTimingFunction: EASE_OUT, animationFillMode: 'both' }),
  }).in;
const compiled = new Map<string, ReturnType<typeof sheet>>();
function motion(kind: AppearProps['kind'], duration: number) {
  const key = `${kind}${duration}`;
  let style = compiled.get(key);
  if (!style) compiled.set(key, (style = sheet(kind, duration)));
  return style;
}

/** The web's Appear: a CSS keyframe on mount, no Reanimated. Unmounting removes it at once. */
export function Appear({ kind, duration, style, children }: AppearProps) {
  return <View style={[style, motion(kind, duration)]}>{children}</View>;
}
