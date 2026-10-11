// Checks for lib/shellNav.ts and the web nav breakpoints. Run: npm run test:unit
import assert from 'node:assert/strict';

import { backBarLine, collectionLine, footerLine, menusLine, navCurrent, shelfLine, shortPersonName, teamLine, webNavFor, type NavMatch } from './shellNav';

const rows: NavMatch[] = [
  { key: 'index', path: '/' },
  { key: 'library', path: '/library' },
  { key: 'menus', path: '/menus/all', prefix: '/menus' },
  { key: 'brand', path: '/settings/bar/b1/brand' },
  { key: 'venue', path: '/settings/bar/b1' },
];

// A row's own path, and paths under a prefix.
assert.equal(navCurrent('/', rows, null), 'index');
assert.equal(navCurrent('/library', rows, 'index'), 'library');
assert.equal(navCurrent('/menus/abc/edit', rows, null), 'menus');
assert.equal(navCurrent('/menus', rows, null), 'menus');
assert.equal(navCurrent('/menusx', rows, null), null);
// Brand is its own row, not Venue settings.
assert.equal(navCurrent('/settings/bar/b1/brand', rows, null), 'brand');
assert.equal(navCurrent('/settings/bar/b1', rows, null), 'venue');
// The add wizard keeps Library lit; a stale key from the other mode doesn't stick.
assert.equal(navCurrent('/add-cocktail', rows, 'library'), 'library');
assert.equal(navCurrent('/add-cocktail', rows, 'collection'), null);
assert.equal(navCurrent('/add-cocktail', rows, null), null);

assert.equal(shortPersonName('Kevin McAlear'), 'Kevin M.');
assert.equal(shortPersonName('  jo  van  park '), 'jo P.');
assert.equal(shortPersonName('Cher'), 'Cher');
assert.equal(shortPersonName(''), 'You');
assert.equal(shortPersonName(null), 'You');

assert.equal(footerLine({ name: 'Little Rye', role: 'Admin' }, 12), 'Admin at Little Rye');
assert.equal(footerLine(null, 46), 'Home bar · 46 bottles');
assert.equal(footerLine(null, 1), 'Home bar · 1 bottle');
assert.equal(footerLine(null, null), 'Home bar');
assert.equal(footerLine(null, 0), 'Home bar');

assert.equal(menusLine([{ name: 'Autumn menu' }], 2), 'Autumn menu on · 2 drafts');
assert.equal(menusLine([{ name: 'A' }, { name: 'B' }], 0), '2 menus on');
assert.equal(menusLine([], 1), '1 draft');
assert.equal(menusLine([], 0), 'Build, schedule and print');
assert.equal(backBarLine(84, 3), '84 placed · 3 waiting');
assert.equal(backBarLine(84, 0), '84 placed');
assert.equal(backBarLine(0, 0), 'Where every bottle lives');
assert.equal(teamLine(9, 2), '9 people · 2 invited');
assert.equal(teamLine(1, 0), '1 person');
assert.equal(shelfLine(4), '4 bottles');
assert.equal(collectionLine(12, 3), '12 to make · 3 menus');
assert.equal(collectionLine(0, 0), 'Drinks to make and your menus');

// Phones and native get the tab bar; 768 to 1199 the rail; 1200 and up the sidebar.
assert.equal(webNavFor('ios', 1400), 'tabs');
assert.equal(webNavFor('web', 390), 'tabs');
assert.equal(webNavFor('web', 767), 'tabs');
assert.equal(webNavFor('web', 768), 'rail');
assert.equal(webNavFor('web', 1199), 'rail');
assert.equal(webNavFor('web', 1200), 'sidebar');

console.log('shellNav checks passed');
