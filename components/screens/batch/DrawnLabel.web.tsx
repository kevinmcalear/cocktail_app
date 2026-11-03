import { lazy, Suspense } from 'react';

import type { BatchLabel } from '../make/MakeLabel';

// The drawn label and its printing load only once a container is ticked, not with every drink page (B13).
const Lazy = lazy(() => import('./LabelBlock').then((m) => ({ default: m.LabelBlock })));

export function DrawnLabel({ label }: { label: BatchLabel }) {
  return (
    <Suspense fallback={null}>
      <Lazy label={label} />
    </Suspense>
  );
}
