import { QueryClientContext } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useContext, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useItemSketch } from '@/hooks/useItemSketch';
import { usePeopleHero } from '@/hooks/usePeopleHero';

import { AnimatedSketch } from './AnimatedSketch';
import { SketchDrawing } from './SketchDrawing';

/** Below this width a drawing drops its searching lines and hatching. */
const THUMB_WIDTH = 140;

interface DrawnSketchProps {
  itemId: string;
  /** Shown until the drawing inputs arrive, or when the drink has none. */
  fallback: ReactNode;
  /** Draw it in front of you, and again on a tap. One per screen (the drink page's hero). */
  animate?: boolean;
}

function Loaded({ itemId, fallback, animate }: DrawnSketchProps) {
  const person = usePeopleHero(itemId).data ?? null;
  const sketch = useItemSketch(person ? null : itemId).data ?? null;
  const [width, setWidth] = useState(0);
  const [play, setPlay] = useState(0);
  if (person) return <Image source={{ uri: person }} style={styles.fill} contentFit="cover" transition={200} />;
  if (!sketch) return <>{fallback}</>;
  if (animate) {
    return (
      // A toy, not a control: screen readers get the picture's label from the frame.
      <Pressable style={styles.fill} onPress={() => setPlay((n) => n + 1)} accessible={false}>
        <AnimatedSketch inputs={sketch} seed={itemId} play={play} />
      </Pressable>
    );
  }
  // Draws straight away as a thumb and adds the full detail once it's measured
  // wide, so a missing or slow layout event never leaves blank paper.
  return (
    <View style={styles.fill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <SketchDrawing inputs={sketch} seed={itemId} detail={width < THUMB_WIDTH ? 'thumb' : 'full'} />
    </View>
  );
}

/**
 * A drink with no photo of its own: the photo someone posted that leads for it
 * (highest ranked), or else a drawing from its drawing inputs (item_sketches).
 * Outside a query client (the gallery, isolated tests) it shows the fallback.
 */
export function DrawnSketch(props: DrawnSketchProps) {
  const client = useContext(QueryClientContext);
  return client ? <Loaded {...props} /> : <>{props.fallback}</>;
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
});
