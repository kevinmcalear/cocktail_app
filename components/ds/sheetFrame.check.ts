// Checks that no sheet docks to the bottom of a browser window. A file that
// draws bottom-sheet corners (rounded top, square bottom) must take its web
// placement from sheetFrame, or have its own .web.tsx twin.
// Run: npm run test:unit
import assert from 'node:assert/strict';
import { existsSync, globSync, readFileSync } from 'node:fs';

// Not sheets: these round the top of a page body or panel that sits in the page.
const PAGES = new Set([
  'components/screens/ingredient/IngredientScreen.tsx', // the page's body over its hero picture
  'components/ui/AdaptiveSheetModal.tsx', // checks Platform.OS itself
]);

const offenders = globSync('{app,components}/**/*.tsx')
  .filter((f) => !f.endsWith('.test.tsx') && !f.endsWith('.native.tsx') && !PAGES.has(f))
  .filter((f) => !existsSync(f.replace(/\.tsx$/, '.web.tsx')))
  .filter((f) => {
    const src = readFileSync(f, 'utf8');
    return /borderTopLeftRadius/.test(src) && !/sheetFrame|sheetIsDialog/.test(src);
  });

assert.deepEqual(offenders, [], `Bottom sheets on the web: place these with sheetFrame (components/ds/sheetFrame.ts):\n  ${offenders.join('\n  ')}`);

console.log('sheetFrame: every sheet is a dialog on the web');
