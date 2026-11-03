import { lazy, Suspense } from 'react';

import type { AgeGateSheetProps } from './AgeGateSheet';

const Lazy = lazy(() => import('./AgeGateSheet').then((m) => ({ default: m.AgeGateSheet })));

/**
 * On the web, the age check's form loads when the gate first asks, not with
 * every page that can ask. Enough routes reach useAgeGate that a static import
 * puts the form on every page's first load (a module used by 20 routes goes
 * into the common chunk; lazy imports don't count).
 */
export function AgeGateSheet(props: AgeGateSheetProps) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
