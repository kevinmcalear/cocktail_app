import { QueryClientContext } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';

import { drawing, radius } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { glowScene, nightScene, onlyStages, withoutStages } from '@/lib/sketch/passes';
import type { Scene } from '@/lib/sketch/scene';
import { sceneToSvg } from '@/lib/sketch/svg';
import { liquidOf, type SketchInputs } from '@/lib/sketch/types';

import { PourLevel } from './PourLevel';
import { sceneFor } from './SketchDrawing';
import { useDs } from './theme';

export type DrawingSize = 'hero' | 'middle' | 'tile' | 'menuRow' | 'row';

/** The list sizes: drawn from the thumbnail scene, on a control's corner, with no pour. */
export const isRowSize = (size: DrawingSize) => size === 'row' || size === 'menuRow';

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

/** A drink's whole drawing as an SVG data URI, by day or painted for night: what a poster or a printed page draws (components/paper). */
export function drawingUri(inputs: SketchInputs, seed: string, night: boolean): string {
  return layersOf(sceneFor(inputs, seed, 'full'), night, liquidOf(inputs).hex).whole;
}

export interface DrinkDrawingProps {
  inputs: SketchInputs;
  /** What makes it this drink's drawing: its id. */
  seed: string;
  /** hero: a drink page (guests 280, staff 180, `staff`); middle: the middle of a menu's three (206); tile: grids and cards (160); menuRow: a menu page's rows (64); row: lists (56). */
  size: DrawingSize;
  /** A staff page: the smaller hero, so the spec stays above the fold. */
  staff?: boolean;
  /** The drink's colour fills the glass as it appears. On by default except in rows; Reduce Motion skips it. */
  pour?: boolean;
  /** Read out ("Drawing of a Negroni on the rocks"); left out, the drawing is decorative. */
  label?: string;
  /** A row or tile without its square of paper, for drawings set together on a sky (a menu's band). */
  bare?: boolean;
}

/**
 * A drink's drawing at one of its sizes, from one painted scene
 * (lib/sketch), in the glass its bar uses (item_sketches already carries the
 * bar's glassware). Light: on the house paper. Dark: painted for night
 * (chalk pencil, the drink lit, a soft glow of the drink behind it). The
 * colour pours in from the bottom of the glass when it appears.
 */
export function DrinkDrawing({ inputs, seed, size, staff, pour = !isRowSize(size), label, bare }: DrinkDrawingProps) {
  const ds = useDs();
  const night = ds.scheme === 'dark';
  const px = size === 'hero' ? (staff ? drawing.heroStaff : drawing.hero) : drawing[size];
  const scene = sceneFor(inputs, seed, isRowSize(size) ? 'thumb' : 'full');
  const layers = layersOf(scene, night, liquidOf(inputs).hex);
  const reduceMotion = useReducedMotion();
  const moving = pour && !reduceMotion;

  const frame = [
    styles.frame,
    { width: px, height: px },
    // A row or tile sits on its own square of paper by day; a hero sits on the page (its sky).
    !night && !bare && size !== 'hero' ? { backgroundColor: ds.c.paper, borderRadius: isRowSize(size) ? radius.control : radius.card } : null,
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
          <PourLevel moving={moving}>{picture(layers.liquid)}</PourLevel>
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
  glow: { opacity: 0.5 },
});
