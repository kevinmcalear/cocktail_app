import { lazy, Suspense, type ComponentProps } from 'react';

import type { ClaimDialog as Real } from './ClaimDialog';

const Lazy = lazy(() => import('./ClaimDialog').then((m) => ({ default: m.ClaimDialog })));

/** On the web the claim flow (its methods, status and checks) loads when someone taps Claim, not with every bar page. */
export function ClaimDialog(props: ComponentProps<typeof Real>) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
