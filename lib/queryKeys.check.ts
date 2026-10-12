import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';

import { PERSISTED_KEYS } from './queryCachePersist';
import { DROPDOWNS_QUERY_KEY, queryDefaults } from './queryDefaults';

// Every key prefix that's saved between launches or given a freshness tier
// must still be the start of a query key somewhere in the app. A hook that
// bumps its key ('venue-2' to 'venue-3') without updating these lists stops
// being saved, and its screen shows a skeleton on every launch.
const source = globSync('{app,components,hooks,lib,ctx,store}/**/*.{ts,tsx}')
  // Not the lists themselves, nor tests.
  .filter((f) => !/\.(check|test)\.tsx?$/.test(f) && !/lib\/(queryCachePersist|queryDefaults)\.ts$/.test(f))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const D = DROPDOWNS_QUERY_KEY[0];
const part = (v: string) => (v === D ? `(?:'${D}'|\\.\\.\\.DROPDOWNS_QUERY_KEY)` : `'${v.replace(/[-]/g, '\\-')}'`);
const used = (prefix: readonly string[]) =>
  new RegExp(`\\[\\s*${prefix.map(part).join('\\s*,\\s*')}\\s*[,\\]]`).test(source);

const prefixes = [...PERSISTED_KEYS, ...queryDefaults(PERSISTED_KEYS).map((d) => d.queryKey)];
const stale = [...new Set(prefixes.map((k) => JSON.stringify(k)))].filter((k) => !used(JSON.parse(k)));
assert.deepEqual(stale, [], `query key prefixes no hook uses any more (renamed or bumped?): ${stale.join(' ')}`);

console.log('queryKeys: ok');
