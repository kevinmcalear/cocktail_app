import { lazy, Suspense } from 'react';

import { useIsHydrated } from '@/hooks/useIsHydrated';

const Lazy = lazy(() => import('./RingScene').then((m) => ({ default: m.RingScene })));

/**
 * On the web the ring's painter loads when a bar with no logo first shows its
 * mark, not with every page. The initials and the colour show meanwhile, and
 * in the static export (a lazy component can't finish on the server).
 */
export function RingScene(props: { id: string; color: string }) {
  const hydrated = useIsHydrated();
  if (!hydrated) return null;
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
