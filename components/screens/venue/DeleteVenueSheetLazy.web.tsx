import { lazy, Suspense, type ComponentProps } from 'react';

import type { DeleteVenueSheet as Sheet } from './DeleteVenueSheet';

const Lazy = lazy(() => import('./DeleteVenueSheet').then((m) => ({ default: m.DeleteVenueSheet })));

/**
 * On the web, the delete-venue sheet loads when its banner or settings row is
 * first drawn (it stays mounted, closed, so it can animate). The banner sits in
 * every page's header, and each route chunk kept its own copy of the sheet.
 */
export function DeleteVenueSheet(props: ComponentProps<typeof Sheet>) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
