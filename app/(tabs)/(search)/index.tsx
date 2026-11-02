/**
 * iPhone's search tab: the system's circle beside the tabs (components/nav/AppTabs.tsx).
 * A group with no path of its own, so /search stays the one address ((1-tonight,2-drinks,3-discover,4-you)/search.tsx);
 * Android and the web never show it (the web loads it on demand: components/nav/SearchTabRoutes.web.tsx).
 */
export { SearchTab as default } from '@/components/nav/SearchTabRoutes';
