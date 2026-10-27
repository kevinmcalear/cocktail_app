import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Body, Caption, useDs } from '@/components/ds';
import { backbar, fontFamilies, radius, space } from '@/constants/tokens';

/** The tag's point, down at the card. */
const TAIL = 7;

/**
 * Over a line it can combine with, the held card's tag: just above the card,
 * where the thumb holding it doesn't cover it, pointing down at it (drag
 * options 1B, Kevin 27 Oct; make-anything-steps-1, step 3). Fades up in; no
 * layout animation (#298).
 */
export function CombineTag({ pair }: { pair: string }) {
  const ds = useDs();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(1, { duration: 140 }));
  }, [shown]);
  const rise = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: (1 - shown.get()) * 6 }] }));
  return (
    <Animated.View role="alert" style={[styles.wrap, rise]}>
      <View style={[styles.tag, { backgroundColor: ds.accentFill.fill }]}>
        <Body tone="onAccent" numberOfLines={1} style={styles.strong}>
          Let go to make it in-house
        </Body>
        <Caption tone="onAccent" numberOfLines={1}>
          {pair}
        </Caption>
      </View>
      <View style={[styles.tail, { borderTopColor: ds.accentFill.fill }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: space.xs, alignItems: 'center', pointerEvents: 'none' },
  tag: { maxWidth: '100%', borderRadius: radius.control, paddingHorizontal: space.md, paddingVertical: space.sm, shadowColor: backbar.dark.ground, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 18, elevation: 10 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  tail: { width: 0, height: 0, borderLeftWidth: TAIL, borderRightWidth: TAIL, borderTopWidth: TAIL, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
});
