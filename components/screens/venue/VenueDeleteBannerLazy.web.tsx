import { lazyOnWeb } from '@/components/lazyOnWeb';

/**
 * On the web, the delete-venue banner under a page title (ScreenHeader on the tabs, NativeHeader on
 * Prep, Study, the You pages) loads after the page, not in each of their route
 * chunks. It shows only while a venue is being deleted, once its request is read.
 */
export const VenueDeleteBanner = lazyOnWeb(() => import('./DeleteVenue').then((m) => m.VenueDeleteBanner));
