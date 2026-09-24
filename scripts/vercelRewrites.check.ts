import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';

// Every dynamic web route needs a Vercel rewrite to its exported HTML shell,
// or opening a shared link like /cocktail/<id> returns a 404.
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  rewrites?: { source: string; destination: string }[];
};
const destinations = new Set((vercel.rewrites ?? []).map((r) => r.destination));

const dynamicRoutes = globSync('app/**/*.tsx')
  .filter((file) => file.includes('['))
  .map((file) =>
    file
      .replace(/^app/, '')
      .replace(/\.tsx$/, '')
      .replace(/\/index$/, '')
      .replace(/\/\([^)]+\)/g, '')
  );

assert.ok(dynamicRoutes.length > 0, 'expected dynamic routes under app/');
const missing = dynamicRoutes.filter((route) => !destinations.has(route));
assert.deepEqual(missing, [], `vercel.json has no rewrite for: ${missing.join(', ')}`);

for (const { source, destination } of vercel.rewrites ?? []) {
  assert.equal(source, destination.replace(/\[(\w+)\]/g, ':$1'), `rewrite source/destination mismatch: ${source}`);
}

console.log(`vercelRewrites.check: ok (${dynamicRoutes.length} dynamic routes)`);
