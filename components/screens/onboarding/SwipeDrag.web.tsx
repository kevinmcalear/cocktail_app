import { lazy, Suspense, type ComponentProps } from 'react';
import { View } from 'react-native';

import type { SwipeDragPan } from './SwipeDragPan';

const Lazy = lazy(() => import('./SwipeDragPan').then((m) => ({ default: m.SwipeDragPan })));

/**
 * The web's swipe card: the drag (SwipeDragPan.tsx) loads when the swipe
 * step first shows, as AgeGateSheetLazy.web.tsx does. Until it's in, the
 * card shows still, and Not for me and Want always answer it (board note
 * loops-n4: the buttons do what swiping does).
 */
export function SwipeDrag(props: ComponentProps<typeof SwipeDragPan>) {
  const still = (
    <View role="img" accessibilityLabel={props.label} style={props.style}>
      {props.children}
    </View>
  );
  return (
    <Suspense fallback={still}>
      <Lazy {...props} />
    </Suspense>
  );
}
