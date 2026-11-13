import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * The web's swipe card: no drag. Not for me and Want answer it (board note
 * loops-n4: the buttons do what swiping does, for Voice Control and the web),
 * and the web bundle doesn't carry Gesture Handler and Reanimated for it.
 */
export function SwipeDrag({ label, style, children }: { onSwipe: (want: boolean) => void; tag: ReactNode; label: string; style: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <View role="img" accessibilityLabel={label} style={style}>
      {children}
    </View>
  );
}
