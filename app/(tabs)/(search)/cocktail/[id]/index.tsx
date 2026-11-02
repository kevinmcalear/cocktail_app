// A drink opened from iPhone's search tab opens on that tab's stack, so Back returns to the results. The shared
// tab folder's drink page can't do it: the search tab isn't one of its groups, so a link to it from here would
// switch to Tonight. One page, a second address in the tree (loaded on demand on the web: SearchTabRoutes.web.tsx).
export { SearchTabDrink as default } from '@/components/nav/SearchTabRoutes';
