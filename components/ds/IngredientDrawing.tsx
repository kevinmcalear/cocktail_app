import { QueryClientContext } from '@tanstack/react-query';
import { memo, useContext } from 'react';

import { useIngredientChain } from '@/hooks/useIngredientChain';
import { paintBottle } from '@/lib/sketch/bottle';
import { ingredientArt } from '@/lib/sketch/ingredientArt';
import { paintProduce } from '@/lib/sketch/produce';
import type { Scene } from '@/lib/sketch/scene';

import { SceneSvg, type SketchDetail } from './SketchDrawing';

const PAPER: Scene = { size: 512, els: [] };

// Painted once per ingredient, kinds and detail, then reused by every tile.
const scenes = new Map<string, Scene>();
function sceneFor(names: string[], role: string | null, seed: string, detail: SketchDetail): Scene {
  const key = `${seed}|${detail}|${role}|${names.join('>')}`;
  let scene = scenes.get(key);
  if (!scene) {
    const art = ingredientArt(names, role, seed);
    scene = art.kind === 'bottle' ? paintBottle(art.inputs, { seed, detail }) : paintProduce(art.inputs, { seed, detail });
    // ponytail: unbounded, but a session sees a few hundred ingredients at most; add an LRU if that changes
    scenes.set(key, scene);
  }
  return scene;
}

type Props = { id?: string | null; name: string; detail?: SketchDetail };

function Loaded({ id, name, detail = 'full' }: Props) {
  const chain = useIngredientChain(id).data;
  // Blank paper while the kinds load, so a drawing never swaps for another.
  if (id && !chain) return <SceneSvg scene={PAPER} />;
  const names = chain?.names.length ? chain.names : [name];
  return <SceneSvg scene={sceneFor(names, chain?.role ?? null, id ?? name, detail)} />;
}

/**
 * An ingredient drawn in the house hand: a bottle, a jar or a small still
 * life, picked from its name and the kinds above it. Without an id (a typed
 * name not in the catalog), or outside a query client (the gallery, isolated
 * tests), it draws from the name alone. Decorative.
 */
export const IngredientDrawing = memo(function IngredientDrawing(props: Props) {
  if (!useContext(QueryClientContext)) return <SceneSvg scene={sceneFor([props.name], null, props.id ?? props.name, props.detail ?? 'full')} />;
  return <Loaded {...props} />;
});
