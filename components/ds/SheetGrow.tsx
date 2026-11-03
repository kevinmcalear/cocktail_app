import { StyleSheet, useWindowDimensions, type ColorValue } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';

import { growFrame, type Box } from './sheetDrag';
import { useDs } from './theme';

/**
 * The card that grows out of the + into a sheet (Prod-motion-sheet step 2):
 * a hairline, a soft shadow, the + going faint in the middle. The sheet's
 * panel fades in over it as it arrives, so its words never squash. Phones only.
 */
export function SheetGrow({ from, grown, size, opacity, drag, bottom, corner, fill }: {
  from: Box;
  /** 0 at the button, 1 where the sheet sits. */
  grown: SharedValue<number>;
  /** The sheet's size, once laid out. */
  size: SharedValue<{ w: number; h: number }>;
  opacity: SharedValue<number>;
  /** How far the sheet is pulled down. */
  drag: SharedValue<number>;
  /** The gap under the sheet. */
  bottom: number;
  corner: number;
  fill: ColorValue;
}) {
  const ds = useDs();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const card = useAnimatedStyle(() => {
    const g = grown.get();
    const { w, h } = size.get();
    if (!w || !h) return { opacity: 0 };
    return {
      ...growFrame(from, { x: (windowWidth - w) / 2, y: windowHeight - bottom - h, width: w, height: h }, corner, windowWidth, windowHeight, g),
      opacity: opacity.get() * interpolate(g, [0, 0.1, 0.85, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: drag.get() }],
    };
  });
  // A quarter strength at the board's step 2.
  const plus = useAnimatedStyle(() => ({ opacity: interpolate(grown.get(), [0, 0.55, 0.85], [1, 0.25, 0], Extrapolation.CLAMP) }));
  return (
    <Animated.View testID="sheet-grow" aria-hidden style={[styles.card, { backgroundColor: fill, borderColor: ds.c.lineStrong, shadowColor: ds.scheme === 'dark' ? ds.c.ground : ds.c.ink }, card]}>
      <Animated.View style={plus}>
        <IconSymbol name="plus" size={22} color={ds.c.ink} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
  },
});
