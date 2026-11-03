/** The Want to go map, loaded with Discover on native (see WantToGoMapLazy.web.tsx). */
import { WantToGoMap as Map } from './WantToGoMap';

/** Nothing to start on native: the map ships with Discover. */
export const WantToGoMap = Object.assign(Map, { preload: () => {} });
