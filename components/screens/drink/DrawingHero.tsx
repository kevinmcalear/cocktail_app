import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { DrinkDrawing, DrinkDrawingFor, useDs } from '@/components/ds';
import { drawing, layout, space } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { drinkSky } from '@/lib/sky';
import { liquidOf, type SketchInputs } from '@/lib/sketch/types';

/** The docked glyph, beside Back (board Draw-scroll, dock). */
export const DOCKED = 34;
/** Over this much scroll the drawing tucks into the bar. */
const DOCK_SCROLL = 260;

/** Where the drawing rests: under the top controls, centred. */
export function drawingTop(top: number) {
  return top + layout.minTapTarget + space.sm * 2 + space.sm;
}

/** The size the drawing rests at: makers get the smaller one, so the spec stays above the fold (decision drawing-sizes). */
export const drawingSize = (maker: boolean) => (maker ? drawing.heroStaff : drawing.hero);

/**
 * The soft sky behind a drawing (lib/sky.ts): the drink's own colour at the
 * top of the page, gone by the title. It scrolls with the page. `tall`: the
 * desktop's longer stops.
 */
export function DrinkSky({ itemId, sketch, tall }: { itemId: string; sketch?: SketchInputs | null; tall?: boolean }) {
  const ds = useDs();
  const stored = useItemSketch(sketch ? null : itemId).data;
  const inputs = sketch ?? stored;
  const sky = drinkSky(inputs ? liquidOf(inputs).hex : null, ds.scheme, ds.c.ground, tall);
  const height = sky.stops[2];
  return <LinearGradient colors={sky.colors} locations={sky.stops.map((s) => s / height) as [number, number, number]} style={[styles.sky, { height }]} />;
}

/**
 * The drawing over the page (Dock, decided 29 Oct): at rest it sits centred
 * under the controls; over the first 260 points of scroll it shrinks into a
 * 34-point glyph in the bar beside Back, so a long spec always shows which
 * drink you're in. Lives above the scroll view, under the buttons.
 */
export function DockedDrawing({ itemId, sketch, label, size, top, width, gutter, scrollY }: { itemId: string; sketch?: SketchInputs | null; label: string; size: number; top: number; width: number; gutter: number; scrollY: SharedValue<number> }) {
  const restLeft = (width - size) / 2;
  const restTop = drawingTop(top);
  const dockLeft = gutter + layout.minTapTarget + space.sm;
  const dockTop = top + space.sm + (layout.minTapTarget - DOCKED) / 2;
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, scrollY.get() / DOCK_SCROLL));
    const q = p * p * (3 - 2 * p);
    return {
      transform: [
        { translateX: interpolate(q, [0, 1], [restLeft, dockLeft]) },
        { translateY: interpolate(q, [0, 1], [restTop, dockTop]) },
        { scale: interpolate(q, [0, 1], [1, DOCKED / size]) },
      ],
    };
  });
  const art = sketch ? <DrinkDrawing inputs={sketch} seed={itemId} size="hero" staff={size === drawing.heroStaff} label={label} /> : <DrinkDrawingFor itemId={itemId} size="hero" staff={size === drawing.heroStaff} label={label} />;
  return <Animated.View style={[styles.dock, { width: size, height: size }, style]}>{art}</Animated.View>;
}

/** The room the drawing takes at the top of the scroll: the controls, the drawing, a breath. */
export function DrawingSpace({ top, size }: { top: number; size: number }) {
  return <View style={{ height: drawingTop(top) + size + space.lg }} />;
}

const styles = StyleSheet.create({
  sky: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' },
  dock: { position: 'absolute', top: 0, left: 0, transformOrigin: 'left top', pointerEvents: 'none' },
});
