import { QueryClientContext } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useContext, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { drawing, pour as POUR, radius } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { glowScene, nightScene, onlyStages, withoutStages } from '@/lib/sketch/passes';
import type { Scene } from '@/lib/sketch/scene';
import { sceneToSvg } from '@/lib/sketch/svg';
import { liquidOf, type SketchInputs } from '@/lib/sketch/types';

import { sceneFor } from './SketchDrawing';
import { useDs } from './theme';

export type DrawingSize = 'hero' | 'tile' | 'row';

const POURED = ['liquid'] as const;

interface Layers {
  whole: string;
  liquid: string;
  rest: string;
  glow: string | null;
}

const uri = (scene: Scene) => `data:image/svg+xml;base64,${btoa(sceneToSvg(scene))}`;

// Built once per painted scene and scheme, then reused while the scene is (sceneFor keeps it per drink).
const cache = new WeakMap<Scene, Map<string, Layers>>();
function layersOf(scene: Scene, night: boolean, liquid: string): Layers {
  let byMode = cache.get(scene);
  if (!byMode) cache.set(scene, (byMode = new Map()));
  const key = night ? 'night' : 'day';
  let layers = byMode.get(key);
  if (!layers) {
    const painted = night ? nightScene(scene, liquid) : scene;
    layers = { whole: uri(painted), liquid: uri(onlyStages(painted, POURED)), rest: uri(withoutStages(painted, POURED)), glow: night ? uri(glowScene(painted)) : null };
    byMode.set(key, layers);
  }
  return layers;
}

export interface DrinkDrawingProps {
  inputs: SketchInputs;
  /** What makes it this drink's drawing: its id. */
  seed: string;
  /** hero: a drink page (guests 280, staff 180, `staff`); tile: grids and cards (160); row: lists (56). */
  size: DrawingSize;
  /** A staff page: the smaller hero, so the spec stays above the fold. */
  staff?: boolean;
  /** The drink's colour fills the glass as it appears. On by default except in rows; Reduce Motion skips it. */
  pour?: boolean;
  /** Read out ("Drawing of a Negroni on the rocks"); left out, the drawing is decorative. */
  label?: string;
}

/**
 * A drink's drawing at one of three sizes, from one painted scene
 * (lib/sketch), in the glass its bar uses (item_sketches already carries the
 * bar's glassware). Light: on the house paper. Dark: painted for night
 * (chalk pencil, the drink lit, a soft glow of the drink behind it). The
 * colour pours in from the bottom of the glass when it appears.
 */
export function DrinkDrawing({ inputs, seed, size, staff, pour = size !== 'row', label }: DrinkDrawingProps) {
  const ds = useDs();
  const night = ds.scheme === 'dark';
  const px = size === 'hero' ? (staff ? drawing.heroStaff : drawing.hero) : drawing[size];
  const scene = sceneFor(inputs, seed, size === 'row' ? 'thumb' : 'full');
  const layers = layersOf(scene, night, liquidOf(inputs).hex);
  const reduceMotion = useReducedMotion();
  const moving = pour && !reduceMotion;
  const fill = useSharedValue(moving ? 0 : 1);
  useEffect(() => {
    if (moving) fill.set(withDelay(POUR.delay, withTiming(1, { duration: POUR.ms, easing: Easing.out(Easing.cubic) })));
  }, [moving, fill]);
  const level = useAnimatedStyle(() => ({ height: `${fill.get() * 100}%` }));

  const frame = [
    styles.frame,
    { width: px, height: px },
    // A row or tile sits on its own square of paper by day; a hero sits on the page (its sky).
    !night && size !== 'hero' ? { backgroundColor: ds.c.paper, borderRadius: size === 'row' ? radius.control : radius.card } : null,
  ];
  const picture = (source: string) => <Image source={{ uri: source }} style={[styles.square, { width: px, height: px }]} contentFit="contain" cachePolicy="memory" accessible={false} />;
  return (
    <View style={frame} {...(label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true })}>
      {layers.glow ? (
        <Image source={{ uri: layers.glow }} style={[StyleSheet.absoluteFill, styles.glow]} blurRadius={Math.max(4, px / 12)} contentFit="contain" cachePolicy="memory" accessible={false} />
      ) : null}
      {pour ? (
        <>
          {/* The liquid, under the pencil, revealed from the bottom of the glass up. */}
          <Animated.View style={[styles.level, level]}>{picture(layers.liquid)}</Animated.View>
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
});
