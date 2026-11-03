import { lazy, Suspense, type ComponentProps } from 'react';

import type { SwapSheet as Real } from './SwapSheet';

const Lazy = lazy(() => import('./SwapSheet').then((m) => ({ default: m.SwapSheet })));

/** On the web the swap sheet loads when Swap is tapped, not with Drinks. */
export function SwapSheet(props: ComponentProps<typeof Real>) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
