import { lazy, Suspense } from 'react';

import type { DrinkScreenProps } from './DrinkScreen';

const Lazy = lazy(() => import('./DrinkScreen').then((m) => ({ default: m.DrinkScreen })));

/**
 * On the web, the drink page in the editors' phone preview comes from the
 * drink page's own chunk (the one Drinks opens beside its list), so the
 * editors don't each carry a copy of it; the empty phone frame shows while it
 * loads.
 */
export function DrinkScreen(props: DrinkScreenProps) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
