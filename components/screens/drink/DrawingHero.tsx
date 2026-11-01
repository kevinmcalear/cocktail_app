import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useDs } from '@/components/ds';
// By path, not the ds barrel: through the barrel its Reanimated pour lands in the web's every-page chunk (check-web-chunks).
import { DrinkDrawing, DrinkDrawingFor } from '@/components/ds/DrinkDrawing';
import { drawing, layout, space } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { drinkSky } from '@/lib/sky';
import { liquidOf, type SketchInputs } from '@/lib/sketch/types';

/** The docked glyph, beside Back (board Draw-scroll, dock; And-page draws 36). */
export const DOCKED = Platform.OS === 'android' ? 36 : 34;
/** Over this much scroll the drawing tucks into the bar. */
export const DOCK_SCROLL = 260;
/** The last points of the Dock, where the system's bar takes over from the drawing over the page. */
export const dockFade = (dock: number) => [dock - space.lg, dock];

/** Where the drawing rests: under the top controls, centred (And-page: 60 under the status bar). */
export function drawingTop(top: number) {
  return top + (Platform.OS === 'android' ? 60 : layout.minTapTarget + space.sm * 2 + space.sm);
}

/** The room the drawing takes at the top of the scroll: the controls, the drawing, a breath. */
export function drawingRoom(top: number, size: number) {
  return drawingTop(top) + size + (Platform.OS === 'android' ? space.xl : space.lg);
}

/** The size the drawing rests at: makers get the smaller one, so the spec stays above the fold (decision drawing-sizes). */
export const drawingSize = (maker: boolean) => (maker ? drawing.heroStaff : drawing.hero);

/**
 * The soft sky behind a drawing (lib/sky.ts): the item's own colour at the
 * top of the page, gone by the title. It scrolls with the page. `tall`: the
 * desktop's longer stops.
 */
export function DrinkSky({ liquid, tall }: { liquid: string | null; tall?: boolean }) {
  const ds = useDs();
  // No colour known yet (or an ingredient drawn without one): plain paper, never a guessed hue.
  if (!liquid) return null;
  const sky = drinkSky(liquid, ds.scheme, ds.c.ground, tall);
  const height = sky.stops[2];
  return <LinearGradient colors={sky.colors} locations={sky.stops.map((s) => s / height) as [number, number, number]} style={[styles.sky, { height }]} />;
}

/** A drink's liquid colour for its sky: the drawing's own (a preview's, else the stored one). */
export function useSkyColour(itemId: string | null, sketch?: SketchInputs | null): string | null {
  const stored = useItemSketch(sketch ? null : itemId).data;
  const inputs = sketch ?? stored;
  return inputs ? liquidOf(inputs).hex : null;
}

/**
 * The drawing over the page (Dock, decided 29 Oct): at rest it sits centred
 * under the controls; over the first 260 points of scroll it shrinks into a
 * 34-point glyph in the bar beside Back, so a long spec always shows which
 * drink you're in. Lives above the scroll view, under the buttons. `handOff`:
 * the system's bar shows the docked glyph itself, so this one fades as it lands.
 */
export function DockedDrawing({ art, size, top, width, dockLeft, dockTop, handOff, scrollY }: { art: ReactNode; size: number; top: number; width: number; dockLeft: number; dockTop: number; handOff?: boolean; scrollY: SharedValue<number> }) {
  const restLeft = (width - size) / 2;
  const restTop = drawingTop(top);
  const fade = dockFade(DOCK_SCROLL);
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, scrollY.get() / DOCK_SCROLL));
    const q = p * p * (3 - 2 * p);
    return {
      opacity: handOff ? interpolate(scrollY.get(), fade, [1, 0], 'clamp') : 1,
      transform: [
        { translateX: interpolate(q, [0, 1], [restLeft, dockLeft]) },
        { translateY: interpolate(q, [0, 1], [restTop, dockTop]) },
        { scale: interpolate(q, [0, 1], [1, DOCKED / size]) },
      ],
    };
  });
  return <Animated.View style={[styles.dock, { width: size, height: size }, style]}>{art}</Animated.View>;
}

/** A drink's drawing at the page's size: a preview's inputs, else its stored drawing. */
export function DrinkArt({ itemId, sketch, label, size, pour }: { itemId: string; sketch?: SketchInputs | null; label: string; size: number; pour?: boolean }) {
  const staff = size === drawing.heroStaff;
  return sketch ? <DrinkDrawing inputs={sketch} seed={itemId} size="hero" staff={staff} pour={pour} label={label} /> : <DrinkDrawingFor itemId={itemId} size="hero" staff={staff} pour={pour} label={label} />;
}

/** A drawing made for `size`, shown at the docked glyph's size in the bar. */
export function DockGlyph({ art, size }: { art: ReactNode; size: number }) {
  return <View style={[styles.glyph, { width: size, height: size, transform: [{ scale: DOCKED / size }] }]}>{art}</View>;
}

/** Holds that room in the scroll. */
export function DrawingSpace({ top, size }: { top: number; size: number }) {
  return <View style={{ height: drawingRoom(top, size) }} />;
}

const styles = StyleSheet.create({
  sky: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' },
  dock: { position: 'absolute', top: 0, left: 0, transformOrigin: 'left top', pointerEvents: 'none' },
  glyph: { transformOrigin: 'left top', pointerEvents: 'none' },
});
