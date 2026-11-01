import { QueryClientContext } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';

import { drawing, pour as POUR, radius } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { liquidOf } from '@/lib/sketch/types';

import { layersOf, type DrinkDrawingProps } from './drinkDrawingLayers';
import { sceneFor } from './SketchDrawing';
import { useDs } from './theme';
import { EASE_OUT, webMotion } from './webMotion';

export type { DrawingSize, DrinkDrawingProps } from './drinkDrawingLayers';

/**
 * The web's DrinkDrawing: the same layers as the native one, the colour
 * pouring in from the bottom of the glass as a CSS keyframe, so the web
 * doesn't load Reanimated (and the pour always finishes). Reduce Motion
 * skips it.
 */
export function DrinkDrawing({ inputs, seed, size, staff, pour = size !== 'row', label, bare }: DrinkDrawingProps) {
  const ds = useDs();
  const night = ds.scheme === 'dark';
  const px = size === 'hero' ? (staff ? drawing.heroStaff : drawing.hero) : drawing[size];
  const scene = sceneFor(inputs, seed, size === 'row' ? 'thumb' : 'full');
  const layers = layersOf(scene, night, liquidOf(inputs).hex);
  const reduceMotion = useReducedMotion();
  const moving = pour && !reduceMotion;

  const frame = [
    styles.frame,
    { width: px, height: px },
    // A row or tile sits on its own square of paper by day; a hero sits on the page (its sky).
    !night && !bare && size !== 'hero' ? { backgroundColor: ds.c.paper, borderRadius: size === 'row' ? radius.control : radius.card } : null,
  ];
  const picture = (source: string) => <Image source={{ uri: source }} style={[styles.square, { width: px, height: px }]} contentFit="contain" cachePolicy="memory" accessible={false} />;
  return (
    <View style={frame} {...(label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true })}>
      {layers.glow ? (
        <Image source={{ uri: layers.glow }} style={[StyleSheet.absoluteFill, styles.glow]} blurRadius={Math.max(4, px / 12)} contentFit="contain" cachePolicy="memory" accessible={false} />
      ) : null}
      {moving ? (
        <>
          {/* The liquid, under the pencil, revealed from the bottom of the glass up. */}
          <View style={[styles.level, styles.pour]}>{picture(layers.liquid)}</View>
          {picture(layers.rest)}
        </>
      ) : (
        picture(layers.whole)
      )}
    </View>
  );
}

/** The same, by drink id: its drawing inputs from item_sketches. Nothing until they arrive, or outside a query client (the gallery). */
export function DrinkDrawingFor({ itemId, ...rest }: Omit<DrinkDrawingProps, 'inputs' | 'seed'> & { itemId: string }) {
  const client = useContext(QueryClientContext);
  return client ? <ById itemId={itemId} {...rest} /> : null;
}

function ById({ itemId, ...rest }: Omit<DrinkDrawingProps, 'inputs' | 'seed'> & { itemId: string }) {
  const inputs = useItemSketch(itemId).data;
  return inputs ? <DrinkDrawing inputs={inputs} seed={itemId} {...rest} /> : null;
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  square: { position: 'absolute', left: 0, bottom: 0 },
  level: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  glow: { opacity: 0.5 },
  // Keyframes only work from StyleSheet.create (react-native-web compiles them to a class).
  pour: webMotion({
    animationKeyframes: { from: { height: '0%' }, to: { height: '100%' } },
    animationDuration: `${POUR.ms}ms`,
    animationDelay: `${POUR.delay}ms`,
    animationTimingFunction: EASE_OUT,
    animationFillMode: 'both',
  }),
});
