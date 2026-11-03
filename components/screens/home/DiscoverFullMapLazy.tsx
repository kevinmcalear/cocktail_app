/** Discover's full map, loaded with Discover on native (see DiscoverFullMapLazy.web.tsx). */
import { DiscoverFullMap as FullMap } from './DiscoverFullMap';

/** Nothing to start on native: the map ships with Discover. */
export const DiscoverFullMap = Object.assign((props: Parameters<typeof FullMap>[0]) => <FullMap {...props} />, { preload: () => {} });
