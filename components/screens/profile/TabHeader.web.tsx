import { lazy, Suspense, type ComponentProps, type ReactNode } from 'react';

import type { ScreenHeader } from '@/components/nav/ScreenHeader';

// The place button and its sheets are most of You's first load, and You's page draws only the gear: they come in their own chunk.
const Lazy = lazy(() => import('@/components/nav/ScreenHeader').then((m) => ({ default: m.ScreenHeader })));

/** The tab's header for You, `fallback` until its chunk arrives. */
export function TabHeader({ fallback, ...props }: ComponentProps<typeof ScreenHeader> & { fallback: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <Lazy {...props} />
    </Suspense>
  );
}
