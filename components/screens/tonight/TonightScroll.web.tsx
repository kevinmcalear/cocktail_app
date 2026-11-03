import type { ReactNode } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';

/** The web's Tonight scroll: the sky scrolls inside it, as there's no pull to cover (TonightScroll.tsx). */
export function TonightScroll({ sky, contentContainerStyle, children }: { sky: ReactNode; cap: ReactNode; contentContainerStyle: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={contentContainerStyle}>
      {sky}
      {children}
    </ScrollView>
  );
}
