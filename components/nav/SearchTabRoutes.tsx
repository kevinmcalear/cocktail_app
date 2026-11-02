import { SearchScreen } from '@/components/search/SearchScreen';

/**
 * The pages of iPhone's search tab (app/(tabs)/(search)), loaded with the tab on native.
 * The web loads them on demand (SearchTabRoutes.web.tsx).
 */
export { default as SearchTabDrink } from '@/app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/cocktail/[id]';

export function SearchTab() {
  return <SearchScreen tab />;
}
