import { lazy, Suspense, type ComponentProps } from 'react';

import type { VenueDeleteBanner as Banner } from './DeleteVenue';

const Lazy = lazy(() => import('./DeleteVenue').then((m) => ({ default: m.VenueDeleteBanner })));

/**
 * On the web, the delete-venue banner under a page title (ScreenHeader on the tabs, NativeHeader on
 * Prep, Study, the You pages) loads after the page, not in each of their route
 * chunks. It shows only while a venue is being deleted, once its request is read.
 */
export function VenueDeleteBanner(props: ComponentProps<typeof Banner>) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
