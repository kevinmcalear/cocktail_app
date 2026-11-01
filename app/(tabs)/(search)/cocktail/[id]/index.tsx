// A drink opened from iPhone's search tab opens on that tab's stack, so Back returns to the results. The shared
// tab folder's drink page can't do it: the search tab isn't one of its groups, so a link to it from here would
// switch to Tonight. One page, a second address in the tree.
export { default } from '../../../(1-tonight,2-drinks,3-discover,4-you)/cocktail/[id]';
