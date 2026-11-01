import { QueryClientContext } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useContext, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useItemSketch } from '@/hooks/useItemSketch';
import { usePeopleHero } from '@/hooks/usePeopleHero';

import { AnimatedSketch } from './AnimatedSketchLazy';
import { SketchDrawing, type SketchDetail } from './SketchDrawing';

interface DrawnSketchProps {
  itemId: string;
  /** Shown until the drawing inputs arrive, or when the drink has none. */
  fallback: ReactNode;
  /** Draw it in front of you, and again on a tap. One per screen (the drink page's hero). */
  animate?: boolean;
  /** 'thumb' for list rows (under about 140 wide): no searching lines or hatching. */
  detail?: SketchDetail;
  /** A list or grid tile: paint in a coming idle slice (SketchDrawing). */
  lazy?: boolean;
}

function Loaded({ itemId, fallback, animate, detail = 'full', lazy }: DrawnSketchProps) {
  const person = usePeopleHero(itemId).data ?? null;
  const drawing = useItemSketch(person ? null : itemId);
  const sketch = drawing.data ?? null;
  const [play, setPlay] = useState(0);
  if (person) return <Image source={{ uri: person }} style={styles.fill} contentFit="cover" transition={200} />;
  // The hero draws its drawing from blank: showing the bare glass while it loads would draw that glass twice.
  if (!sketch) return animate && drawing.isPending ? null : <>{fallback}</>;
  if (animate) {
    return (
      // A toy, not a control: screen readers get the picture's label from the frame.
      <Pressable style={styles.fill} onPress={() => setPlay((n) => n + 1)} accessible={false}>
        <AnimatedSketch inputs={sketch} seed={itemId} play={play} />
      </Pressable>
    );
  }
  // The caller says how much detail, rather than a layout pass measuring it: no
  // second render, and nothing waits on a layout event that may never come (#284).
  return (
    <View style={styles.fill}>
      <SketchDrawing inputs={sketch} seed={itemId} detail={detail} lazy={lazy} />
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
