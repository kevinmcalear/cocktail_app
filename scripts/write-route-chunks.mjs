// Writes dist/route-chunks.json: the scripts each main screen's page loads, so
// the web app can prefetch them once the first screen's data is in
// (lib/prefetchRoutes.web.ts) and a first tap to them doesn't wait on the
// network. Run after `expo export -p web` (see build:web). Fails when a listed
// page is gone, so a renamed route doesn't silently stop being prefetched.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// The screens people go to next: the tabs, and a drink.
const PAGES = ['index', 'library', 'discover', 'bar', 'menus', 'search', 'cocktail/[id]'];

const routes = {};
for (const page of PAGES) {
  const file = [`dist/${page}.html`, `dist/(tabs)/${page}.html`].find(existsSync);
  if (!file) throw new Error(`write-route-chunks: no page for ${page}; update PAGES`);
  routes[page] = [...new Set(readFileSync(file, 'utf8').match(/\/_expo\/static\/js\/web\/[^"]+\.js/g) ?? [])];
}

writeFileSync('dist/route-chunks.json', `${JSON.stringify(routes)}\n`);
console.log(`wrote dist/route-chunks.json (${PAGES.length} pages)`);
