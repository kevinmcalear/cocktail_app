import { QueryClientContext } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { memo, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useIngredientChain, type IngredientChain } from '@/hooks/useIngredientChain';
import { paintBottle } from '@/lib/sketch/bottle';
import { ingredientArt, type IngredientArt } from '@/lib/sketch/ingredientArt';
import { nightScene } from '@/lib/sketch/passes';
import { paintProduce } from '@/lib/sketch/produce';
import type { Scene } from '@/lib/sketch/scene';
import { markNoThumb, thumbToTry } from '@/lib/thumbnails';

import { SceneSvg, type SketchDetail } from './SketchDrawing';
import { useScene } from './useScene';
import { useDs } from './theme';

// Painted once per ingredient, kinds, detail and night, then reused by every tile.
// ponytail: unbounded, but a session sees a few hundred ingredients at most; add an LRU if that changes
const scenes = new Map<string, Scene>();
const keyFor = (names: string[], role: string | null, seed: string, detail: SketchDetail, night = false) => `${seed}|${detail}|${role}|${names.join('>')}${night ? '|night' : ''}`;
/** Its colour: the bottle's liquid, the fruit's skin. The page's sky and night's lit colour. */
const colourOf = (art: IngredientArt) => (art.kind === 'bottle' ? art.inputs.liquid.hex : art.inputs.color);
function paint(names: string[], role: string | null, seed: string, detail: SketchDetail, night = false): Scene {
  const art = ingredientArt(names, role, seed);
  const scene = art.kind === 'bottle' ? paintBottle(art.inputs, { seed, detail }) : paintProduce(art.inputs, { seed, detail });
  return night ? nightScene(scene, colourOf(art)) : scene;
}
function sceneFor(names: string[], role: string | null, seed: string, detail: SketchDetail): Scene {
  const key = keyFor(names, role, seed, detail);
  let scene = scenes.get(key);
  if (!scene) scenes.set(key, (scene = paint(names, role, seed, detail)));
  return scene;
}

type Props = {
  id?: string | null;
  name: string;
  detail?: SketchDetail;
  lazy?: boolean;
  /** No paper behind it (SceneSvg). */
  bare?: boolean;
  /** Always the drawing, whatever its picture is (the Drawing choice, a new ingredient drawn from its kind). */
  drawn?: boolean;
  /** In dark, painted for night like a drink's hero: chalk pencil, its colour lit (the ingredient page's hero). */
  night?: boolean;
};

/**
 * Its own photo, cover-filled. Small sizes ask for the 480 px copy first
 * (lib/thumbnails.ts), as drink tiles do, and fall back to the original.
 */
export function IngredientPhoto({ url, small }: { url: string; small?: boolean }) {
  const [noThumb, setNoThumb] = useState<string | null>(null);
  const thumb = small && noThumb !== url ? thumbToTry(url) : null;
  return (
    <Image
      source={{ uri: thumb ?? url }}
      style={styles.fill}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      recyclingKey={url}
      accessible={false}
      onError={
        thumb
          ? () => {
              markNoThumb(url);
              setNoThumb(url);
            }
          : undefined
      }
    />
  );
}

function Loaded({ id, name, detail = 'full', lazy = detail === 'thumb', bare, drawn, night }: Props) {
  const ds = useDs();
  const chain = useIngredientChain(id).data;
  const picture = drawn ? null : chain?.picture;
  if (picture?.kind === 'photo') return <IngredientPhoto url={picture.url} small={lazy} />;
  // None keeps the space: plain paper, so rows and grids stay in line.
  if (picture?.kind === 'none') return bare ? null : <View style={[styles.fill, { backgroundColor: ds.c.paper }]} />;
  return <Drawn id={id} name={name} detail={detail} lazy={lazy} bare={bare} chain={chain} night={!!night && ds.scheme === 'dark'} />;
}

function Drawn({ id, name, detail, lazy, bare, chain, night }: { id?: string | null; name: string; detail: SketchDetail; lazy: boolean; bare?: boolean; chain: IngredientChain | undefined; night: boolean }) {
  const names = chain?.names.length ? chain.names : [name];
  const role = chain?.role ?? null;
  // Blank paper while the kinds load (a null key), so a drawing never swaps for another.
  const key = id && !chain ? null : keyFor(names, role, id ?? name, detail, night);
  return <SceneSvg bare={bare} scene={useScene(scenes, key, lazy, () => paint(names, role, id ?? name, detail, night))} />;
}

/**
 * The colour its drawing is painted in, for the soft sky over its page
 * (boards Item-page, Desk-page: a syrup's amber, a gin's cold glass). Null
 * while its kinds load, so the sky doesn't change colour once they arrive.
 */
export function useIngredientColour(id: string, name: string): string | null {
  const chain = useIngredientChain(id).data;
  if (!chain) return null;
  return colourOf(ingredientArt(chain.names.length ? chain.names : [name], chain.role ?? null, id));
}

/**
 * An ingredient's picture, the one place every list, spec line and page gets
 * it: drawn in the house hand (a bottle, a jar or a small still life, picked
 * from its name and the kinds above it), or what its editor chose instead
 * (items.picture): its own photo, or None, plain paper. Without an id (a typed
 * name not in the catalog), or outside a query client (the gallery, isolated
 * tests), it draws from the name alone. Decorative. `lazy` (thumbs, and tiles
 * in a grid) paints when the app is idle, on blank paper till then.
 */
export const IngredientDrawing = memo(function IngredientDrawing(props: Props) {
  if (!useContext(QueryClientContext)) return <SceneSvg bare={props.bare} scene={sceneFor([props.name], null, props.id ?? props.name, props.detail ?? 'full')} />;
  return <Loaded {...props} />;
});

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
});
