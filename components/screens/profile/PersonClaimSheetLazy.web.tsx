import { lazy, Suspense, type ComponentProps } from 'react';

import type { PersonClaimSheet as Real } from './PersonClaimSheet';

const Lazy = lazy(() => import('./PersonClaimSheet').then((m) => ({ default: m.PersonClaimSheet })));

/** On the web the This is me sheet loads when a person page is first drawn (it stays mounted, closed, so it can animate), not with the page. */
export function PersonClaimSheet(props: ComponentProps<typeof Real>) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
