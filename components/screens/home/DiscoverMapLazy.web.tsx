import { lazyOnWeb } from '@/components/lazyOnWeb';

/**
 * On the web the map (MapLibre's wrapper, its pins and styles) loads when the
 * map card first draws, not with the Discover tab's first load (quality budget
 * B13, /discover). `mapAvailable` is the web build's answer, kept here so the
 * screen needn't import the map to ask.
 */
export const mapAvailable = true;
export const DiscoverMap = lazyOnWeb(() => import('./DiscoverMap').then((m) => m.DiscoverMap));
