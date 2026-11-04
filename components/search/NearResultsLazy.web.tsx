import { lazy, Suspense, type ComponentProps } from 'react';

import type * as Near from './NearResults';

const LazyNear = lazy(() => import('./NearResults').then((m) => ({ default: m.NearResults })));

/*
 * The Drinks tab shows near results only once something is typed, so on the
 * web they load from their own chunk and the tab's first load (quality budget
 * B13, /drinks) doesn't carry the result rows and the near search.
 */
export function NearResults(props: ComponentProps<typeof Near.NearResults>) {
  return (
    <Suspense fallback={null}>
      <LazyNear {...props} />
    </Suspense>
  );
}
