import { lazy, Suspense } from 'react';

const Lazy = lazy(() => import('./RankIt').then((m) => ({ default: m.RankIt })));

/**
 * On the web, Rank it (its field, camera button and return listener) loads
 * right after Tonight's first paint, not inside the first load every page shares.
 */
export function RankIt() {
  return (
    <Suspense fallback={null}>
      <Lazy />
    </Suspense>
  );
}
