import { lazy, Suspense, type ComponentProps } from 'react';

import type { PictureViewer as Real } from './PictureViewer';

const Lazy = lazy(() => import('./PictureViewer').then((m) => ({ default: m.PictureViewer })));

/** On the web the full-screen picture viewer loads after the drink, not with it (it stays mounted, closed, so it can animate). */
export function PictureViewer(props: ComponentProps<typeof Real>) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
