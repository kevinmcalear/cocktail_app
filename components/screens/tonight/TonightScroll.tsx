import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { ScrollSky } from '@/components/ds/ScrollSky';

/**
 * Tonight's scroll with its sky behind it, so a pull past the top shows more
 * sky, not a hard edge (Kevin, 3 Nov). The web (TonightScroll.web.tsx) has no
 * pull, and keeps Reanimated off its first load.
 */
export function TonightScroll({ sky, cap, contentContainerStyle, children }: { sky: ReactNode; cap: ReactNode; contentContainerStyle: StyleProp<ViewStyle>; children: ReactNode }) {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => scrollY.set(e.contentOffset.y));
  return (
    <>
      <ScrollSky scrollY={scrollY} cap={cap}>
        {sky}
      </ScrollSky>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={contentContainerStyle}>
        {children}
      </Animated.ScrollView>
    </>
  );
}
