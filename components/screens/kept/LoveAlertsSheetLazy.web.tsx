import { lazy, Suspense, type ComponentProps } from 'react';

import type { LoveAlertsSheet as Real } from './LoveAlertsSheet';

const Lazy = lazy(() => import('./LoveAlertsSheet').then((m) => ({ default: m.LoveAlertsSheet })));

/** On the web the alerts sheet loads when Love asks what to send, not with the page. */
export function LoveAlertsSheet(props: ComponentProps<typeof Real>) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
