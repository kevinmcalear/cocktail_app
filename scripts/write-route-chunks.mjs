// Writes dist/route-chunks.json: the scripts each main screen's page loads, so
// the web app can prefetch them once the first screen's data is in
// (lib/prefetchRoutes.web.ts) and a first tap to them doesn't wait on the
// network. Run after `expo export -p web` (see build:web). Fails when a listed
// page is gone, so a renamed route doesn't silently stop being prefetched.
import { writeFileSync } from 'node:fs';

import { pageFile, pageScripts } from './web-pages.mjs';

// The screens people go to next: the four tabs, search, and a drink.
const PAGES = ['index', 'drinks', 'discover', 'you', 'search', 'cocktail/[id]'];

const routes = {};
for (const page of PAGES) {
  const file = pageFile(page);
  if (!file) throw new Error(`write-route-chunks: no page for ${page}; update PAGES`);
  routes[page] = pageScripts(file);
}

writeFileSync('dist/route-chunks.json', `${JSON.stringify(routes)}\n`);
console.log(`wrote dist/route-chunks.json (${PAGES.length} pages)`);
