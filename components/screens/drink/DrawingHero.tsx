import { LinearGradient } from 'expo-linear-gradient';
import { QueryClientContext } from '@tanstack/react-query';
import { useContext, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useDs } from '@/components/ds';
// The web loads it (and its Reanimated) when the hero first draws, not with every page.
import { AnimatedSketch } from '@/components/ds/AnimatedSketchLazy';
// By path, not the ds barrel: through the barrel its Reanimated pour lands in the web's every-page chunk (check-web-chunks).
import { DrinkDrawing, DrinkDrawingFor } from '@/components/ds/DrinkDrawing';
import { drawing, layout, space } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { useReducedMotion } from '@/hooks/useReducedMotion';
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

/** The sky's top edge, for ScrollSky's pull: its first colour. */
export function DrinkSkyCap({ liquid }: { liquid: string | null }) {
  const ds = useDs();
  if (!liquid) return null;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: drinkSky(liquid, ds.scheme, ds.c.ground).colors[0] }]} />;
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

/**
 * A drink's drawing at the page's size (a preview's inputs, else its stored
 * drawing), made in front of you and again on each `play`: the pencil finds
 * the glass rim first, the drink spreads in, ice drops, foam rises, the
 * garnish lands, bubbles climb (AnimatedSketch). At night it's painted for
 * night with the drink's glow, as the still drawing is. Reduce Motion: the
 * still drawing.
 */
export function DrinkArt({ sketch, ...rest }: ArtProps & { sketch?: SketchInputs | null }) {
  const client = useContext(QueryClientContext);
  if (sketch) return <Staged inputs={sketch} {...rest} />;
  // Outside a query client (isolated tests) there's no stored drawing to ask for.
  return client ? <Stored {...rest} /> : null;
}

interface ArtProps {
  itemId: string;
  label: string;
  size: number;
  play: number;
}

function Stored(props: ArtProps) {
  const stored = useItemSketch(props.itemId);
  if (stored.data) return <Staged inputs={stored.data} {...props} />;
  // It draws from blank paper, so blank paper while the drawing loads: the bare glass first would draw that glass twice.
  // Only while it's being fetched: offline (a paused query) shows the bare glass.
  if (stored.isLoading) return <View style={{ width: props.size, height: props.size }} role="img" aria-label={props.label} />;
  // No drawing yet: the bare glass, still.
  return <DrinkDrawingFor itemId={props.itemId} size="hero" staff={props.size === drawing.heroStaff} label={props.label} />;
}

function Staged({ inputs, itemId, label, size, play }: ArtProps & { inputs: SketchInputs }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <DrinkDrawing inputs={inputs} seed={itemId} size="hero" staff={size === drawing.heroStaff} label={label} />;
  return (
    <View style={[styles.art, { width: size, height: size }]} role="img" aria-label={label}>
      <AnimatedSketch inputs={inputs} seed={itemId} play={play} glow />
    </View>
  );
}

/**
 * Holds that room in the scroll. The drawing floats over it and lets touches
 * through, so a tap on it lands here and draws it again; a drag still scrolls.
 */
export function DrawingSpace({ top, size, onReplay }: { top: number; size: number; onReplay: () => void }) {
  return (
    <View style={{ height: drawingRoom(top, size), paddingTop: drawingTop(top), alignItems: 'center' }}>
      {/* A toy, not a control: screen readers get the picture's label from the drawing. */}
      <Pressable onPress={onReplay} accessible={false} style={{ width: size, height: size }} />
    </View>
  );
}

const styles = StyleSheet.create({
  sky: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' },
  dock: { position: 'absolute', top: 0, left: 0, transformOrigin: 'left top', pointerEvents: 'none' },
  art: { overflow: 'hidden' },
});
