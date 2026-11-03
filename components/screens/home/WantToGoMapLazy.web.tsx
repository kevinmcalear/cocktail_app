import { lazy, Suspense } from 'react';

const Lazy = lazy(() => import('./WantToGoMap').then((m) => ({ default: m.WantToGoMap })));

/**
 * On the web the Want to go map (its bottom sheet, with Reanimated and Gesture
 * Handler: most of Discover's code) loads when Collection's "See them on the
 * map" opens it, not with every Discover page.
 */
export function WantToGoMap() {
  return (
    <Suspense fallback={null}>
      <Lazy />
    </Suspense>
  );
}
