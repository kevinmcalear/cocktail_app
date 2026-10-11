// A web file and its native twin must share an extension. Metro tries each
// extension in turn (.ts before .tsx) and the platform file within it, so a
// native Thing.ts beats Thing.web.tsx on the web, silently: the web then
// loads the native code (and, for the files that keep Reanimated off the
// web, Reanimated on every page). Run: npm run test:unit
import assert from 'node:assert/strict';
import { existsSync, globSync } from 'node:fs';

const mismatched = globSync('{app,components,hooks,lib,ctx,store}/**/*.web.{ts,tsx}').flatMap((web) => {
  const [, base, ext] = web.match(/^(.*)\.web\.(tsx?)$/)!;
  const other = ext === 'ts' ? 'tsx' : 'ts';
  return existsSync(`${base}.${other}`) ? [`${web} vs ${base}.${other}`] : [];
});
assert.deepEqual(mismatched, [], `rename so each pair shares an extension: ${mismatched.join(', ')}`);

console.log('platformFiles.check: ok');
