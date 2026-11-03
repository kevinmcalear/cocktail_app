import { StyleSheet, View } from 'react-native';

import { SceneSvg } from '@/components/ds/SketchDrawing';
import { useScene } from '@/components/ds/useScene';
import { paintRingMark } from '@/lib/sketch/ringMark';
import type { Scene } from '@/lib/sketch/scene';

// One painting per bar and colour pair; a person sees a handful of bars.
const rings = new Map<string, Scene>();

/** The ring a glass leaves, painted in `color`, filling its mark (VenueMarks' RingMark). */
export function RingScene({ id, color }: { id: string; color: string }) {
  const scene = useScene(rings, `${id}|${color}`, false, () => paintRingMark(color, color, id));
  return (
    <View style={StyleSheet.absoluteFill}>
      <SceneSvg scene={scene} bare />
    </View>
  );
}
