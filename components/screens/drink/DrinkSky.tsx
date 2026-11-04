import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useDs } from '@/components/ds';
import { useItemSketch } from '@/hooks/useItemSketch';
import { drinkSky } from '@/lib/sky';
import { liquidOf, type SketchInputs } from '@/lib/sketch/types';

/**
 * The soft sky behind a drawing (lib/sky.ts): the item's own colour at the
 * top of the page, gone by the title. It scrolls with the page. `tall`: the
 * desktop's longer stops.
 */
export function DrinkSky({ liquid, tall }: { liquid: string | null; tall?: boolean }) {
  const ds = useDs();
  // No colour known yet (or an ingredient drawn without one): plain paper, never a guessed hue.
  if (!liquid) return null;
  const sky = drinkSky(liquid, ds.scheme, ds.c.ground, tall);
  const height = sky.stops[2];
  return <LinearGradient colors={sky.colors} locations={sky.stops.map((s) => s / height) as [number, number, number]} style={[styles.sky, { height }]} />;
}

/** The sky's top edge, for ScrollSky's pull: its first colour. */
export function DrinkSkyCap({ liquid }: { liquid: string | null }) {
  const ds = useDs();
  if (!liquid) return null;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: drinkSky(liquid, ds.scheme, ds.c.ground).colors[0] }]} />;
}

/** A drink's liquid colour for its sky: the drawing's own (a preview's, else the stored one). */
export function useSkyColour(itemId: string | null, sketch?: SketchInputs | null): string | null {
  const stored = useItemSketch(sketch ? null : itemId).data;
  const inputs = sketch ?? stored;
  return inputs ? liquidOf(inputs).hex : null;
}

const styles = StyleSheet.create({
  sky: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' },
});
