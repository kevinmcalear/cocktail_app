import { lazy, Suspense, type ComponentProps } from 'react';

import type { AddAwardSheet as Real } from './AddAwardSheet';

const Lazy = lazy(() => import('./AddAwardSheet').then((m) => ({ default: m.AddAwardSheet })));

/** On the web the add-award sheet loads after the page, not with it (it stays mounted, closed, so it can animate). */
export function AddAwardSheet(props: ComponentProps<typeof Real>) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
