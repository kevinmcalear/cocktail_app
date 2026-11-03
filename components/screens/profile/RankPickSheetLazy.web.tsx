import { lazy, Suspense, type ComponentProps } from 'react';

import type { RankPickSheet as Real } from './RankPickSheet';

const Lazy = lazy(() => import('./RankPickSheet').then((m) => ({ default: m.RankPickSheet })));

/** On the web the rank-a-drink picker loads after the bar page, not with it (it stays mounted, closed, so it can animate). */
export function RankPickSheet(props: ComponentProps<typeof Real>) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
