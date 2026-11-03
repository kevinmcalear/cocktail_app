import { lazyOnWeb } from '@/components/lazyOnWeb';

/**
 * On the web Discover's full map (its bar sheet and the bar card) loads when
 * the map card's Open the map opens it, not with every Discover page, so
 * /discover's first load stays as it was. Discover starts the download once
 * the card shows (`preload`).
 */
export const DiscoverFullMap = lazyOnWeb(() => import('./DiscoverFullMap').then((m) => m.DiscoverFullMap));
