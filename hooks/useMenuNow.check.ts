// Every screen that reads a menu's dates takes its clock from useMenuNow, so a
// menu put on now reads On now once the refetch lands (walk finding A, 12 Nov).
// A frozen `const [now] = useState(() => Date.now())` beside menu dates fails here.
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';

const FROZEN = /const \[\w+\] = useState\(\(\) => Date\.now\(\)\)/;
const MENU_DATES = /\b(menuStatus|groupMenus|menuDrinks|pourersOf|barMenuPicks|menuPageModel|homeMenuLine|useVenueMenus|useSavedMenus)\b/;

const offenders = globSync('{app,components,hooks,lib}/**/*.{ts,tsx}')
  .filter((f) => f !== 'hooks/useMenuNow.ts' && !f.endsWith('.check.ts') && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
  .filter((f) => {
    const src = readFileSync(f, 'utf8');
    return FROZEN.test(src) && MENU_DATES.test(src);
  });

assert.deepEqual(offenders, [], `These read menu dates against the moment they opened; use useMenuNow(query.dataUpdatedAt):\n  ${offenders.join('\n  ')}`);
