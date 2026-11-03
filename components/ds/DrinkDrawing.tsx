import { QueryClientContext } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { drawing } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { whenIdle } from '@/lib/idleQueue';
import { inBarGlassCached } from '@/lib/sketch/barGlass';
import { bareGlassSketch } from '@/lib/sketch/draft';
import { glowScene, nightScene, onlyStages, withoutStages } from '@/lib/sketch/passes';
import type { Scene } from '@/lib/sketch/scene';
import { sceneToSvg } from '@/lib/sketch/svg';
import { liquidOf, type SketchInputs } from '@/lib/sketch/types';

import { useDrawingGlasses } from './drawingGlasses';
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

// Built once per drink, size and scheme, then reused (TanStack Query keeps the inputs object stable until the row changes).
const cache = new WeakMap<SketchInputs, Map<string, Layers>>();
const keyOf = (seed: string, thumb: boolean, night: boolean, pour: boolean) => `${seed}|${thumb ? 't' : 'f'}|${night ? 'n' : 'd'}|${pour ? 'p' : 'w'}`;
function build(inputs: SketchInputs, seed: string, thumb: boolean, night: boolean, pour: boolean): Layers {
  let byKey = cache.get(inputs);
  if (!byKey) cache.set(inputs, (byKey = new Map()));
  const key = keyOf(seed, thumb, night, pour);
  let layers = byKey.get(key);
  if (!layers) {
    const scene = sceneFor(inputs, seed, thumb ? 'thumb' : 'full');
    const painted = night ? nightScene(scene, liquidOf(inputs).hex) : scene;
    const glow = night ? uri(glowScene(painted)) : null;
    // A drawing that doesn't pour is one picture; only a pouring one needs the liquid apart from the pencil.
    layers = pour
      ? { whole: '', liquid: uri(onlyStages(painted, POURED)), rest: uri(withoutStages(painted, POURED)), glow }
      : { whole: uri(painted), liquid: '', rest: '', glow };
    byKey.set(key, layers);
  }
  return layers;
}
const peek = (inputs: SketchInputs, seed: string, thumb: boolean, night: boolean, pour: boolean) => cache.get(inputs)?.get(keyOf(seed, thumb, night, pour));

// The bare glass every drawing shows until its own is ready (the board's drawn glass, never a blank hole).
const BARE = bareGlassSketch('Coupe');

/** The bare glass at a drawing's size, for a place with no drawing (yet): never a blank hole. */
export function BareGlass({ size }: Pick<DrinkDrawingProps, 'size'>) {
  return <DrinkDrawing inputs={BARE} seed="bare" size={size} pour={false} />;
}

/** A drink's whole drawing as an SVG data URI, by day or painted for night: what a poster or a printed page draws (components/paper). */
export function drawingUri(inputs: SketchInputs, seed: string, night: boolean): string {
  return build(inputs, seed, false, night, false).whole;
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
}

/**
 * A drink's drawing at one of its sizes, from one painted scene
 * (lib/sketch), in the glass of the bar it's shown at (DrawingBar; its own
 * bar's glassware comes in item_sketches). Light: the pencil on the page
 * itself, no card behind it (decision chrome). Dark: painted for night (chalk
 * pencil, the drink lit, a soft glow of the drink behind it). The colour pours
 * in from the bottom of the glass when it appears.
 */
export function DrinkDrawing({ inputs: stored, seed, size, staff, pour = !isRowSize(size), label }: DrinkDrawingProps) {
  const ds = useDs();
  const inputs = inBarGlassCached(stored, useDrawingGlasses());
  const night = ds.scheme === 'dark';
  const px = size === 'hero' ? (staff ? drawing.heroStaff : drawing.hero) : drawing[size];
  const thumb = isRowSize(size);
  // A hero paints now; lists and grids paint in coming idle slices, the bare glass showing until then.
  const lazy = size !== 'hero';
  // The idle job builds into the cache and bumps this to re-render; `ready` is always read from the cache, so a scheme switch can't show the old one.
  const [, built] = useState(0);
  const ready = peek(inputs, seed, thumb, night, pour) ?? null;
  useEffect(() => {
    if (ready || !lazy) return;
    let live = true;
    whenIdle(() => {
      if (!live) return;
      build(inputs, seed, thumb, night, pour);
      built((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [ready, lazy, inputs, seed, thumb, night, pour]);
  const layers = ready ?? (lazy ? build(BARE, 'bare', thumb, night, false) : build(inputs, seed, thumb, night, pour));
  const showPour = pour && (!lazy || !!ready);
  const reduceMotion = useReducedMotion();
  const moving = pour && !reduceMotion;

  const frame = [styles.frame, { width: px, height: px }];
  const picture = (source: string) => <Image source={{ uri: source }} style={[styles.square, { width: px, height: px }]} contentFit="contain" cachePolicy="memory" accessible={false} />;
  return (
    <View style={frame} {...(label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true })}>
      {layers.glow ? (
        <Image source={{ uri: layers.glow }} style={[StyleSheet.absoluteFill, styles.glow]} blurRadius={Math.max(4, px / 12)} contentFit="contain" cachePolicy="memory" accessible={false} />
      ) : null}
      {showPour ? (
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

/** The same, by drink id: its drawing inputs from item_sketches. The bare glass until they arrive (saved between launches); nothing outside a query client (the gallery). */
export function DrinkDrawingFor({ itemId, ...rest }: Omit<DrinkDrawingProps, 'inputs' | 'seed'> & { itemId: string }) {
  const client = useContext(QueryClientContext);
  return client ? <ById itemId={itemId} {...rest} /> : null;
}

function ById({ itemId, ...rest }: Omit<DrinkDrawingProps, 'inputs' | 'seed'> & { itemId: string }) {
  const inputs = useItemSketch(itemId).data;
  // Until they arrive: the bare glass on its paper, no pour (the real one pours when it lands).
  return inputs ? <DrinkDrawing inputs={inputs} seed={itemId} {...rest} /> : <DrinkDrawing inputs={BARE} seed="bare" {...rest} pour={false} />;
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  square: { position: 'absolute', left: 0, bottom: 0 },
  glow: { opacity: 0.5 },
});
