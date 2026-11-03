import { lazyOnWeb } from '@/components/lazyOnWeb';

/**
 * On the web the Want to go map (its bottom sheet, with Reanimated and Gesture
 * Handler: most of Discover's code) loads when Collection's "See them on the
 * map" opens it, not with every Discover page. Your bars, where that link is,
 * starts the download when it shows (`preload`).
 */
export const WantToGoMap = lazyOnWeb(() => import('./WantToGoMap').then((m) => m.WantToGoMap));
