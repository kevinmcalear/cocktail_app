import { lazy, Suspense, type ComponentProps } from 'react';

import type { HoursSheet as Real } from './HoursSheet';

const Lazy = lazy(() => import('./HoursSheet').then((m) => ({ default: m.HoursSheet })));

/** On the web the week of hours loads after the bar page, not with it. */
export function HoursSheet(props: ComponentProps<typeof Real>) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
