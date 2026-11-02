import { SearchScreen } from '@/components/search/SearchScreen';

/**
 * Search's one address, /search (and /search?q=rye&scope=everywhere): a page
 * pushed on the tab you opened it from on Android and phone-width web, so a
 * drink opened from the results lands on that tab's stack and Back returns to
 * the search. On iPhone it hands what it carries to the search tab, on wide
 * screens to the ⌘K palette (components/search/SearchScreen.tsx).
 */
export default function SearchRoute() {
  return <SearchScreen />;
}
