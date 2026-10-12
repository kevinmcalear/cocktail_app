import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutUp } from 'react-native-reanimated';

export interface AppearProps {
  /** Fade in and out, or slide down from above the screen and back. */
  kind: 'fade' | 'slide';
  /** How long it takes to come in, in ms. */
  duration: number;
  /** How long it takes to go, in ms (native only; the web removes it at once). */
  leave?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** A view that animates in when it mounts and out when it unmounts. The web does it in CSS (Appear.web.tsx). */
export function Appear({ kind, duration, leave = duration, style, children }: AppearProps) {
  const entering = kind === 'fade' ? FadeIn.duration(duration) : SlideInUp.duration(duration);
  const exiting = kind === 'fade' ? FadeOut.duration(leave) : SlideOutUp.duration(leave);
  return (
    <Animated.View entering={entering} exiting={exiting} style={style}>
      {children}
    </Animated.View>
  );
}
