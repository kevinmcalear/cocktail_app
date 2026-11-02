import { lazy } from 'react';

/**
 * The web never shows iPhone's search tab, but its routes still export, and a
 * route that imports a page statically counts as one more user of everything
 * that page uses. The web build moves a module used by 20 routes into the chunk
 * every page loads first (patches/@expo+metro-config, COMMON_CHUNK_MIN_USERS),
 * so these two copies put the drink page's prep, pricing and glassware hooks
 * and the age check on every first load. Loaded on demand they count once
 * (lazy imports don't count), and the expo-router Suspense around each route
 * covers the load. Native keeps them static (SearchTabRoutes.tsx).
 */
export const SearchTabDrink = lazy(() => import('@/app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/cocktail/[id]'));

const LazySearchScreen = lazy(() => import('@/components/search/SearchScreen').then((m) => ({ default: m.SearchScreen })));

export function SearchTab() {
  return <LazySearchScreen tab />;
}
