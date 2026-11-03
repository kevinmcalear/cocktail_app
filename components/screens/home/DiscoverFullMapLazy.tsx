/** Discover's full map, loaded with Discover on native (see DiscoverFullMapLazy.web.tsx). */
import { DiscoverFullMap as Map } from './DiscoverFullMap';

/** Nothing to start on native: the map ships with Discover. */
export const DiscoverFullMap = Object.assign(Map, { preload: () => {} });
