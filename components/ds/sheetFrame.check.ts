// Checks the app's sheets. No sheet docks to the bottom of a browser window: a
// file that draws bottom-sheet corners (rounded top, square bottom) must take
// its web placement from sheetFrame, or have its own .web.tsx twin. And no
// sheet is hand-built on a Modal: a Modal with a rounded-top panel brings back
// the backdrop that slides up with the sheet. Those build on Sheet.
// Run: npm run test:unit
import assert from 'node:assert/strict';
import { existsSync, globSync, readFileSync } from 'node:fs';

// Not sheets: these round the top of a page body or panel that sits in the page.
const PAGES = new Set([
  'components/screens/ingredient/IngredientScreen.tsx', // the page's body over its hero picture
]);
const SHEET = 'components/ds/Sheet.tsx';

const files = globSync('{app,components}/**/*.tsx').filter((f) => !f.endsWith('.test.tsx') && !PAGES.has(f));
const source = (f: string) => readFileSync(f, 'utf8');

const docked = files
  .filter((f) => !f.endsWith('.native.tsx') && !existsSync(f.replace(/\.tsx$/, '.web.tsx')))
  .filter((f) => /borderTopLeftRadius/.test(source(f)) && !/sheetFrame|sheetIsDialog/.test(source(f)));
assert.deepEqual(docked, [], `Bottom sheets on the web: place these with sheetFrame (components/ds/sheetFrame.ts):\n  ${docked.join('\n  ')}`);

const handBuilt = files.filter((f) => f !== SHEET && /<Modal\b/.test(source(f)) && /borderTopLeftRadius/.test(source(f)));
assert.deepEqual(handBuilt, [], `Hand-built Modal sheets: build these on Sheet (components/ds/Sheet.tsx):\n  ${handBuilt.join('\n  ')}`);

console.log('sheetFrame: every sheet is the one Sheet, and a dialog on the web');
