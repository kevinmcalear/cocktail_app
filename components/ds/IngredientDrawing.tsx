import { QueryClientContext } from '@tanstack/react-query';
import { memo, useContext } from 'react';

import { useIngredientChain } from '@/hooks/useIngredientChain';
import { paintBottle } from '@/lib/sketch/bottle';
import { ingredientArt } from '@/lib/sketch/ingredientArt';
import { paintProduce } from '@/lib/sketch/produce';
import type { Scene } from '@/lib/sketch/scene';

import { SceneSvg, type SketchDetail } from './SketchDrawing';
import { useScene } from './useScene';

// Painted once per ingredient, kinds and detail, then reused by every tile.
// ponytail: unbounded, but a session sees a few hundred ingredients at most; add an LRU if that changes
const scenes = new Map<string, Scene>();
const keyFor = (names: string[], role: string | null, seed: string, detail: SketchDetail) => `${seed}|${detail}|${role}|${names.join('>')}`;
function paint(names: string[], role: string | null, seed: string, detail: SketchDetail): Scene {
  const art = ingredientArt(names, role, seed);
  return art.kind === 'bottle' ? paintBottle(art.inputs, { seed, detail }) : paintProduce(art.inputs, { seed, detail });
}
function sceneFor(names: string[], role: string | null, seed: string, detail: SketchDetail): Scene {
  const key = keyFor(names, role, seed, detail);
  let scene = scenes.get(key);
  if (!scene) scenes.set(key, (scene = paint(names, role, seed, detail)));
  return scene;
}

type Props = { id?: string | null; name: string; detail?: SketchDetail; lazy?: boolean; /** No paper behind it (SceneSvg). */ bare?: boolean };

function Loaded({ id, name, detail = 'full', lazy = detail === 'thumb', bare }: Props) {
  const chain = useIngredientChain(id).data;
  const names = chain?.names.length ? chain.names : [name];
  const role = chain?.role ?? null;
  // Blank paper while the kinds load (a null key), so a drawing never swaps for another.
  const key = id && !chain ? null : keyFor(names, role, id ?? name, detail);
  return <SceneSvg bare={bare} scene={useScene(scenes, key, lazy, () => paint(names, role, id ?? name, detail))} />;
}

/**
 * An ingredient drawn in the house hand: a bottle, a jar or a small still
 * life, picked from its name and the kinds above it. Without an id (a typed
 * name not in the catalog), or outside a query client (the gallery, isolated
 * tests), it draws from the name alone. Decorative. `lazy` (thumbs, and tiles
 * in a grid) paints when the app is idle, on blank paper till then.
 */
export const IngredientDrawing = memo(function IngredientDrawing(props: Props) {
  if (!useContext(QueryClientContext)) return <SceneSvg bare={props.bare} scene={sceneFor([props.name], null, props.id ?? props.name, props.detail ?? 'full')} />;
  return <Loaded {...props} />;
});
