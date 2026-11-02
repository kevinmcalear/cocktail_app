import { Image } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { DrinkDrawing, DrinkImage, isRowSize, useDs, type DrawingSize } from '@/components/ds';
import { sceneFor } from '@/components/ds/SketchDrawing';
import { ICON_STROKE } from '@/components/ui/glyphs';
import { drawing, radius } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { isPrivateDrink } from '@/lib/menus';
import { CHALK, mapScene, pencilOnly } from '@/lib/sketch/passes';
import type { Scene } from '@/lib/sketch/scene';
import { sceneToSvg } from '@/lib/sketch/svg';

/** colour: as published. pencil: a draft's, until it is published (D1). faded: a past menu's, a third of its colour (P1). */
export type MenuInk = 'colour' | 'pencil' | 'faded';

const pencils = new WeakMap<Scene, Map<string, string>>();
function pencilUri(scene: Scene, night: boolean): string {
  let byMode = pencils.get(scene);
  if (!byMode) pencils.set(scene, (byMode = new Map()));
  const key = night ? 'night' : 'day';
  let out = byMode.get(key);
  if (!out) {
    // At night the pencil is chalk.
    const lines = pencilOnly(scene);
    byMode.set(key, (out = `data:image/svg+xml;base64,${btoa(sceneToSvg(night ? mapScene(lines, (el) => (el.k === 'stroke' ? { ...el, color: CHALK } : el)) : lines))}`));
  }
  return out;
}

/**
 * A drink's drawing on a menu page: in colour, in pencil while its menu is a
 * draft, or faded on a past menu; the colour pours in as on the drink page.
 * A drink with nothing to draw from (beer, wine) shows its picture, so every
 * row has one.
 * `bare`: no square of paper behind a row (drawings set together on a sky).
 */
export function MenuDrawing({ itemId, size, ink, fallback, bare }: { itemId: string; size: DrawingSize; ink: MenuInk; fallback?: { imageUrl: string | null; glass: string | null }; bare?: boolean }) {
  const ds = useDs();
  // A place held for a drink kept private has no id the database would take, and nothing to draw.
  const kept = isPrivateDrink(itemId);
  const inputs = useItemSketch(kept ? null : itemId).data;
  const px = size === 'hero' ? drawing.heroStaff : drawing[size];
  if (kept) {
    return (
      <View style={[styles.kept, { width: px, height: px, backgroundColor: ds.c.paper }]} aria-hidden>
        {/* CustomIcons' Martini, drawn here: the whole icon set would ride in every menu page's chunk (B12). */}
        <Svg width={Math.round(px * 0.55)} height={Math.round(px * 0.55)} viewBox="0 0 24 24">
          <Path d="M2 5 L12 15 L22 5 Z M12 15 L12 22 M8 22 L16 22 M16 7 L12 12" stroke={ds.c.sketchInk} strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </View>
    );
  }
  if (!inputs) {
    if (!fallback) return <View style={{ width: px, height: px }} />;
    return (
      <View style={{ width: px }} aria-hidden>
        <DrinkImage thumb source={fallback.imageUrl} glass={fallback.glass} itemId={itemId} accessibilityLabel="" radius="control" />
      </View>
    );
  }
  if (ink === 'pencil') {
    const paper = !bare && isRowSize(size) && ds.scheme !== 'dark' ? { backgroundColor: ds.c.paper, borderRadius: radius.control } : null;
    const uri = pencilUri(sceneFor(inputs, itemId, isRowSize(size) ? 'thumb' : 'full'), ds.scheme === 'dark');
    return (
      <View style={[{ width: px, height: px, overflow: 'hidden' }, paper]} aria-hidden>
        <Image source={{ uri }} style={{ width: px, height: px }} contentFit="contain" cachePolicy="memory" accessible={false} />
      </View>
    );
  }
  return (
    <View style={ink === 'faded' ? styles.faded : undefined} aria-hidden>
      <DrinkDrawing inputs={inputs} seed={itemId} size={size} staff={size === 'hero'} pour={!isRowSize(size) && ink === 'colour'} bare={bare} />
    </View>
  );
}

const styles = StyleSheet.create({
  kept: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.control },
  // A third of its colour. RN has no saturate on iOS, so native dims instead.
  faded: Platform.OS === 'web' ? { filter: 'saturate(0.35)', opacity: 0.9 } : { opacity: 0.45 },
});
