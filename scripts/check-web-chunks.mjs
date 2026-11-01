// After `expo export -p web` (see build:web): fails when Reanimated is in the
// common chunk every web page loads, or the public chunk the share pages load. The web keeps it to the screens that
// animate with it (components/ds/webMotion.ts, GestureRoot, the lazy
// imports); one stray import of Reanimated or Gesture Handler in shared code
// puts ~140 KB brotli back on every page.
import { globSync, readFileSync } from 'node:fs';

const [common] = globSync('dist/_expo/static/js/web/__common-*.js');
if (!common) throw new Error('check-web-chunks: no common chunk in dist');
for (const file of [common, ...globSync('dist/_expo/static/js/web/__public-*.js')]) {
  if (readFileSync(file, 'utf8').includes('[Reanimated]')) {
    console.error(`check-web-chunks: Reanimated is in ${file.split('/').pop()}. Find the shared import (Reanimated, Gesture Handler, or a component using them) and give it a .web.tsx or a lazy import.`);
    process.exit(1);
  }
}
console.log('check-web-chunks: ok');
