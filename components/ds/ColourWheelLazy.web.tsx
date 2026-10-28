import { lazy, Suspense } from 'react';

import type { ColourWheelProps } from './ColourWheel';

const Lazy = lazy(() => import('./ColourWheel').then((m) => ({ default: m.ColourWheel })));

/**
 * On the web, the wheel (and the Gesture Handler code it runs on) loads when
 * Custom is first picked, not with every page that shows the brand form; the
 * Hex field below it works meanwhile.
 */
export function ColourWheel(props: ColourWheelProps) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
