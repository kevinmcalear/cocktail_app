import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { drawing } from '@/constants/tokens';

import { trioLayout, trioPlaces, type TrioLayout } from './trioPlaces';

/**
 * Up to three drawings together, overlapping, the middle of three larger,
 * higher and in front (the fourth drawing size). Each is drawn at its size and
 * scaled to its place. `draw` gives one drawing: DrinkDrawingFor, or a menu's
 * pencil or faded one.
 */
export function DrawingTrio({ ids, layout = trioLayout(), draw }: { ids: readonly string[]; layout?: TrioLayout; draw: (id: string, size: 'tile' | 'middle') => ReactNode }) {
  const { places, width, height } = trioPlaces(ids.length, layout);
  return (
    <View style={{ width, height }} aria-hidden>
      {places.map((p, i) => {
        const px = drawing[p.drawn];
        return (
          <View key={i} style={[styles.place, { left: p.x, top: p.y, width: p.s, height: p.s, zIndex: p.front ? 1 : 0 }]}>
            <View style={p.s === px ? undefined : { transform: [{ scale: p.s / px }] }}>{draw(ids[i], p.drawn)}</View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  place: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
