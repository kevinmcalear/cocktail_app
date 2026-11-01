import { Image } from 'expo-image';
import { View } from 'react-native';

import { DrinkDrawing, DrinkImage, useDs, type DrawingSize } from '@/components/ds';
import { sceneFor } from '@/components/ds/SketchDrawing';
import { drawing, radius } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { CHALK, mapScene, pencilOnly } from '@/lib/sketch/passes';
import type { Scene } from '@/lib/sketch/scene';
import { sceneToSvg } from '@/lib/sketch/svg';
import type { SketchInputs } from '@/lib/sketch/types';

/** colour: as published. pencil: a draft's, until it is published (D1). faded: a past menu's, a third of its colour (P1). */
export type MenuInk = 'colour' | 'pencil' | 'faded';

const pencils = new WeakMap<Scene, Map<string, string>>();
function pencilUri(scene: Scene, night: boolean): string {
  let byMode = pencils.get(scene);
  if (!byMode) pencils.set(scene, (byMode = new Map()));
  const key = night ? 'night' : 'day';
  let out = byMode.get(key);
  if (!out) {
    const pencil = pencilOnly(scene);
    const shown = night ? mapScene(pencil, (el) => (el.k === 'stroke' ? { ...el, color: CHALK } : el)) : pencil;
    byMode.set(key, (out = `data:image/svg+xml;base64,${btoa(sceneToSvg(shown))}`));
  }
  return out;
}

/**
 * A drink's drawing on a menu page: in colour, in pencil while its menu is a
 * draft, or faded on a past menu. A drink with nothing to draw from (beer,
 * wine) shows its picture, so every row still has one.
 */
export function MenuDrawing({ itemId, size, ink, fallback }: { itemId: string; size: DrawingSize; ink: MenuInk; fallback?: { imageUrl: string | null; glass: string | null } }) {
  const ds = useDs();
  const inputs = useItemSketch(itemId).data;
  const px = size === 'hero' ? drawing.heroStaff : drawing[size];
  if (!inputs) {
    if (!fallback) return <View style={{ width: px, height: px }} />;
    return (
      <View style={{ width: px }} aria-hidden>
        <DrinkImage thumb source={fallback.imageUrl} glass={fallback.glass} itemId={itemId} accessibilityLabel="" radius="control" />
      </View>
    );
  }
  if (ink === 'pencil') return <Pencil inputs={inputs} seed={itemId} px={px} paper={size === 'row' && ds.scheme !== 'dark' ? ds.c.paper : null} />;
  return (
    <View style={ink === 'faded' ? { opacity: 0.45 } : undefined} aria-hidden>
      <DrinkDrawing inputs={inputs} seed={itemId} size={size} staff={size === 'hero'} pour={size !== 'row' && ink === 'colour'} />
    </View>
  );
}

function Pencil({ inputs, seed, px, paper }: { inputs: SketchInputs; seed: string; px: number; paper: string | null }) {
  const ds = useDs();
  const uri = pencilUri(sceneFor(inputs, seed, px <= drawing.row ? 'thumb' : 'full'), ds.scheme === 'dark');
  return (
    <View style={{ width: px, height: px, backgroundColor: paper ?? undefined, borderRadius: radius.control, overflow: 'hidden' }} aria-hidden>
      <Image source={{ uri }} style={{ width: px, height: px }} contentFit="contain" cachePolicy="memory" accessible={false} />
    </View>
  );
}
