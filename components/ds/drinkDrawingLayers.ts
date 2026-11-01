// What both DrinkDrawing twins share: a drink's painted scene as image
// layers (whole, the liquid alone for the pour, the rest, the night glow),
// and the props. Its own file so the web twin doesn't import the native one.
import { glowScene, nightScene, onlyStages, withoutStages } from '@/lib/sketch/passes';
import type { Scene } from '@/lib/sketch/scene';
import { sceneToSvg } from '@/lib/sketch/svg';
import type { SketchInputs } from '@/lib/sketch/types';

export type DrawingSize = 'hero' | 'tile' | 'row';

const POURED = ['liquid'] as const;

export interface Layers {
  whole: string;
  liquid: string;
  rest: string;
  glow: string | null;
}

const uri = (scene: Scene) => `data:image/svg+xml;base64,${btoa(sceneToSvg(scene))}`;

// Built once per painted scene and scheme, then reused while the scene is (sceneFor keeps it per drink).
const cache = new WeakMap<Scene, Map<string, Layers>>();
export function layersOf(scene: Scene, night: boolean, liquid: string): Layers {
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
  /** A row or tile without its square of paper, for drawings set together on a sky (a menu's band). */
  bare?: boolean;
}

