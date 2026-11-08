import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, type ColorValue } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';

import { growFrame, type Box } from './sheetDrag';
import { useDs } from './theme';

/**
 * The sheet growing out of the + (Prod-motion-sheet): one card, the sheet
 * itself. Its frame grows from the button (wide first, then down to where the
 * sheet sits, growFrame) and clips the panel, which stays put at its full
 * size, so the words never squash or reflow; the panel fades in as the card
 * opens over it and the + fades out. At the end the card is the panel's own
 * frame, so nothing is swapped. Phones only.
 */
export function SheetGrow({ from, grown, size, drag, bottom, corner, fill, width, children }: {
  from: Box;
  /** 0 at the button, 1 where the sheet sits. */
  grown: SharedValue<number>;
  /** The panel's size, once laid out. */
  size: SharedValue<{ w: number; h: number }>;
  /** How far the sheet is pulled down. */
  drag: SharedValue<number>;
  /** The gap under the sheet. */
  bottom: number;
  corner: number;
  fill: ColorValue;
  /** The panel's width: it lays out at this, whatever the card's size. */
  width: number;
  /** The panel. */
  children: ReactNode;
}) {
  const ds = useDs();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Where the card is at `g`, in the window, and where the panel rests; null until the panel is laid out.
  // Each style reads grown and size itself: a style follows only the shared values its own worklet reads,
  // so one reached through this helper alone stayed where it started.
  const frames = (g: number, { w, h }: { w: number; h: number }) => {
    'worklet';
    if (!w || !h) return null;
    const to = { x: (windowWidth - w) / 2, y: windowHeight - bottom - h, width: w, height: h };
    return { to, at: growFrame(from, to, corner, windowWidth, windowHeight, g) };
  };
  // In the flow where the sheet sits (so the keyboard lifts it), moved to the grow frame.
  const card = useAnimatedStyle(() => {
    const g = grown.get();
    const f = frames(g, size.get());
    if (!f) return { opacity: 0, height: 0 };
    const { at } = f;
    return {
      opacity: 1,
      width: at.width,
      height: at.height,
      borderRadius: at.borderRadius,
      shadowOpacity: interpolate(g, [0.8, 1], [0.2, 0], Extrapolation.CLAMP),
      transform: [{ translateX: at.left - (windowWidth - at.width) / 2 }, { translateY: at.top - (windowHeight - bottom - at.height) + drag.get() }],
    };
  });
  const clip = useAnimatedStyle(() => ({ borderRadius: frames(grown.get(), size.get())?.at.borderRadius ?? corner }));
  // The panel stays where it rests while the card opens over it.
  const place = useAnimatedStyle(() => {
    const f = frames(grown.get(), size.get());
    return f ? { transform: [{ translateX: f.to.x - f.at.left }, { translateY: f.to.y - f.at.top }] } : {};
  });
  // A quarter strength at the board's step 2.
  const plus = useAnimatedStyle(() => ({ opacity: interpolate(grown.get(), [0, 0.55, 0.85], [1, 0.25, 0], Extrapolation.CLAMP) }));
  return (
    <Animated.View testID="sheet-grow" style={[styles.card, { marginBottom: bottom, backgroundColor: fill, shadowColor: ds.scheme === 'dark' ? ds.c.ground : ds.c.ink }, card]}>
      <Animated.View aria-hidden style={[styles.plus, plus]}>
        <IconSymbol name="plus" size={22} color={ds.c.ink} />
      </Animated.View>
      <Animated.View style={[styles.clip, clip]}>
        <Animated.View style={[styles.place, { width }, place]}>{children}</Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderCurve: 'continuous', pointerEvents: 'box-none', shadowOffset: { width: 0, height: 20 }, shadowRadius: 25 },
  plus: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  clip: { ...StyleSheet.absoluteFill, overflow: 'hidden', borderCurve: 'continuous', pointerEvents: 'box-none' },
  place: { position: 'absolute', top: 0, left: 0, pointerEvents: 'box-none' },
});
