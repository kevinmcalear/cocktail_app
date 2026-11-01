// The pages of a web export (`expo export -p web`) and the scripts each one
// loads first. Shared by write-route-chunks.mjs (what to prefetch) and
// budgets.mjs (first-load JS per page).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The exported HTML for a page ('index', 'drinks', 'd/[id]'), or undefined.
 * A tab's page also exports under (tabs)/, and a route with its own layout
 * (the search tab's stack) as a folder's index.html.
 */
export function pageFile(page, dist = 'dist') {
  return [`${page}.html`, `(tabs)/${page}.html`, `${page}/index.html`].map((f) => join(dist, f)).find((f) => existsSync(f));
}

/** The app's scripts a page's HTML loads, once each, as site paths (/_expo/static/js/web/...). */
export function pageScripts(file) {
  return [...new Set(readFileSync(file, 'utf8').match(/\/_expo\/static\/js\/web\/[^"]+\.js/g) ?? [])];
}
