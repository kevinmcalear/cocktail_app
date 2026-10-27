import { Pressable } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';

import type { PressableScaleProps } from './PressableScale';
import { isLinkEnter, releaseFocusAfterPointer } from './releaseFocus';
import { EASE_OUT, webMotion } from './webMotion';

const SQUEEZE = webMotion({ transitionProperty: 'transform', transitionDuration: '120ms', transitionTimingFunction: EASE_OUT });

/**
 * The web's press: the same small squeeze as a CSS transition, so the browser
 * shows it on the tap's own frame and the web needn't load Reanimated
 * (PressableScale.tsx springs it on native, with a haptic tick).
 */
export function PressableScale({ haptic: _haptic, style, onPress, onKeyDown, ...rest }: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      role="button"
      {...rest}
      onPress={
        onPress
          ? (e) => {
              releaseFocusAfterPointer(e);
              onPress(e);
            }
          : undefined
      }
      onKeyDown={(e) => {
        onKeyDown?.(e);
        const native = e.nativeEvent as { key: string; defaultPrevented?: boolean };
        if (onPress && !rest.disabled && !native.defaultPrevented && isLinkEnter(rest.role ?? undefined, native.key, e.currentTarget as { tagName?: string })) {
          // ponytail: a keyboard event stands in for the press event here; RN's press type has no keyboard form.
          onPress(e as unknown as Parameters<typeof onPress>[0]);
        }
      }}
      style={({ pressed }) => [style, SQUEEZE, pressed && !reduceMotion && { transform: [{ scale: 0.96 }] }]}
    />
  );
}
