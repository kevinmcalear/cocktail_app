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

// The link-preview middleware's paths (/d/<id or slug>, /m/<id or slug>) are
// the same pages: a person who opens /d/penicillin gets the /d/[id] shell.
const middleware = readFileSync('middleware.ts', 'utf8');
const matcher = [...(/matcher: \[([^\]]*)\]/.exec(middleware)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
assert.ok(matcher.length > 0, 'expected a matcher in middleware.ts');
const sources = new Set((vercel.rewrites ?? []).map((r) => r.source));
for (const path of matcher) assert.ok(sources.has(path), `middleware matches ${path}, but vercel.json has no rewrite for it`);

for (const { source, destination } of vercel.rewrites ?? []) {
  assert.equal(source, destination.replace(/\[(\w+)\]/g, ':$1'), `rewrite source/destination mismatch: ${source}`);
}

console.log(`vercelRewrites.check: ok (${dynamicRoutes.length} dynamic routes)`);
