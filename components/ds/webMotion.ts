import type { ViewStyle } from 'react-native';

/**
 * react-native-web's CSS transition and keyframe styles, which React Native's
 * types don't list. For the web versions of animated components (*.web.tsx),
 * so the web doesn't load Reanimated on every page (RAIL load).
 */
interface WebMotion {
  transitionProperty?: string;
  transitionDuration?: string;
  transitionTimingFunction?: string;
  animationKeyframes?: Record<string, ViewStyle>;
  animationDuration?: string;
  animationTimingFunction?: string;
  animationIterationCount?: number | 'infinite';
  animationDirection?: 'normal' | 'alternate';
  animationFillMode?: 'both' | 'forwards';
}

/** Typed as an empty style so it fits any style slot (StyleSheet.create, a style array) under every set of React Native types. */
export const webMotion = (style: WebMotion) => style as Record<never, never>;

/** Easing.out(Easing.cubic) and Easing.in(Easing.cubic), as CSS. */
export const EASE_OUT = 'cubic-bezier(0.33, 1, 0.68, 1)';
export const EASE_IN = 'cubic-bezier(0.32, 0, 0.67, 0)';
