import { QueryClientContext } from '@tanstack/react-query';
import { useContext, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useItemSketch } from '@/hooks/useItemSketch';

import { SketchDrawing } from './SketchDrawing';

/** Below this width a drawing drops its searching lines and hatching. */
const THUMB_WIDTH = 140;

interface DrawnSketchProps {
  itemId: string;
  /** Shown until the drawing inputs arrive, or when the drink has none. */
  fallback: ReactNode;
}

function Loaded({ itemId, fallback }: DrawnSketchProps) {
  const sketch = useItemSketch(itemId).data ?? null;
  const [width, setWidth] = useState(0);
  if (!sketch) return <>{fallback}</>;
  // Draws straight away as a thumb and adds the full detail once it's measured
  // wide, so a missing or slow layout event never leaves blank paper.
  return (
    <View style={styles.fill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <SketchDrawing inputs={sketch} seed={itemId} detail={width < THUMB_WIDTH ? 'thumb' : 'full'} />
    </View>
  );
}

/**
 * A drink with no photo, drawn from its drawing inputs (item_sketches). Outside
 * a query client (the gallery, isolated tests) it shows the fallback.
 */
export function DrawnSketch(props: DrawnSketchProps) {
  const client = useContext(QueryClientContext);
  return client ? <Loaded {...props} /> : <>{props.fallback}</>;
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
});
